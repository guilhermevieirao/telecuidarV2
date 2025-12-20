import { Injectable, Renderer2, RendererFactory2, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private renderer: Renderer2;
  private readonly THEME_KEY = 'telecuidar-theme';
  
  // Observable para mudanças de tema
  private isDarkThemeSubject = new BehaviorSubject<boolean>(false);
  public isDarkTheme$ = this.isDarkThemeSubject.asObservable();

  constructor(
    rendererFactory: RendererFactory2,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initTheme();
  }

  private initTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem(this.THEME_KEY);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = savedTheme || (prefersDark ? 'dark' : 'light');
      this.setTheme(theme);
    }
  }

  private setTheme(theme: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const isDark = theme === 'dark';
      if (isDark) {
        this.renderer.setAttribute(document.documentElement, 'data-theme', 'dark');
      } else {
        this.renderer.removeAttribute(document.documentElement, 'data-theme');
      }
      localStorage.setItem(this.THEME_KEY, theme);
      this.isDarkThemeSubject.next(isDark);
    }
  }

  toggleTheme(): void {
    const currentTheme = this.isDarkMode() ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  isDarkMode(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return false;
  }
}
