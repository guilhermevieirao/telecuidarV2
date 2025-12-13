import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DictationService {
  private recognition: any;
  private isListening = false;
  private activeElement: HTMLInputElement | HTMLTextAreaElement | null = null;
  private lastInterim = '';
  
  public isDictationActive$ = new BehaviorSubject<boolean>(false);
  public isListening$ = new BehaviorSubject<boolean>(false);

  constructor(private zone: NgZone) {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'pt-BR';

        this.recognition.onresult = (event: any) => {
          this.zone.run(() => {
            this.handleResult(event);
          });
        };

        this.recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          this.zone.run(() => {
            this.stopListening();
          });
        };

        this.recognition.onend = () => {
          this.zone.run(() => {
            if (this.isListening) {
              this.recognition.start(); // Restart if supposed to be listening
            } else {
              this.isListening$.next(false);
            }
          });
        };
        
        // Setup global focus listener to track active input
        document.addEventListener('focusin', (e) => {
          const target = e.target as HTMLElement;
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            this.activeElement = target;
            this.lastInterim = ''; // Reset when switching inputs
          }
        });
      }
    }
  }

  toggleDictation() {
    if (this.isDictationActive$.value) {
      this.stopDictation();
    } else {
      this.startDictation();
    }
  }

  startDictation() {
    if (!this.recognition) {
      alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }
    this.isDictationActive$.next(true);
    this.startListening();
  }

  stopDictation() {
    this.isDictationActive$.next(false);
    this.stopListening();
    this.activeElement = null;
    this.lastInterim = '';
  }

  private startListening() {
    if (!this.isListening && this.recognition) {
      try {
        this.recognition.start();
        this.isListening = true;
        this.isListening$.next(true);
      } catch (e) {
        console.error('Error starting speech recognition', e);
      }
    }
  }

  private stopListening() {
    if (this.isListening && this.recognition) {
      this.isListening = false;
      this.isListening$.next(false);
      this.recognition.stop();
    }
  }

  private handleResult(event: any) {
    if (!this.activeElement) return;

    let newFinals = '';
    let newInterim = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        if (newFinals && !newFinals.endsWith(' ') && !transcript.startsWith(' ')) {
          newFinals += ' ';
        }
        newFinals += transcript;
      } else {
        newInterim += transcript;
      }
    }

    let currentValue = this.activeElement.value;
    
    // 1. Remove previous interim text if it exists at the end
    if (this.lastInterim && currentValue.endsWith(this.lastInterim)) {
      currentValue = currentValue.slice(0, -this.lastInterim.length);
    }
    
    // 2. Prepare text to add (Finals + Interim)
    let trackedInterim = '';
    
    // Add finals
    if (newFinals) {
       const prefix = (currentValue && !currentValue.endsWith(' ')) ? ' ' : '';
       currentValue += prefix + newFinals;
    }
    
    // Add interim
    if (newInterim) {
       const prefix = (currentValue && !currentValue.endsWith(' ')) ? ' ' : '';
       trackedInterim = prefix + newInterim;
       currentValue += trackedInterim;
    }
    
    this.activeElement.value = currentValue;
    this.lastInterim = trackedInterim;
    
    // Dispatch input event to trigger Angular/Reactive Forms updates
    this.activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    this.activeElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
