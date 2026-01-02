import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, ElementRef, ViewChildren, QueryList, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { InfoModalComponent, InfoModalData } from '../info-modal/info-modal';

interface Step {
  number: string;
  title: string;
  description: string;
  features: string[];
  details: string[];
  image: string;
  imageAlt: string;
}

@Component({
  selector: 'app-solution',
  imports: [CommonModule, InfoModalComponent],
  templateUrl: './solution.html',
  styleUrl: './solution.scss'
})
export class SolutionComponent implements OnInit, OnDestroy, AfterViewInit {
  selectedModal: InfoModalData | null = null;
  isModalOpen = false;
  activeStep = 0;
  
  @ViewChildren('timelineItem') timelineItems!: QueryList<ElementRef>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  private stepIcons: Record<string, string> = {
    '1': '📋',
    '2': '🤖',
    '3': '🏥',
    '4': '👨‍⚕️',
    '5': '📱',
    '6': '📄'
  };

  steps: Step[] = [
    {
      number: '1',
      title: 'Cadastro e Agendamento',
      description: 'App intuitivo para cadastro e agendamento com múltiplas especialidades disponíveis.',
      features: ['App intuitivo', 'Múltiplas especialidades', 'Agendamento fácil'],
      image: 'images/landing/step-registration.jpg',
      imageAlt: 'Paciente agendando consulta pelo aplicativo',
      details: [
        'Interface simples e acessível para todos os públicos',
        'Cadastro integrado com Cartão Nacional de Saúde',
        'Visualização de especialidades disponíveis em tempo real',
        'Seleção de horários conforme disponibilidade',
        'Confirmação automática via SMS e notificação push',
        'Lembretes antes da consulta para reduzir faltas'
      ]
    },
    {
      number: '2',
      title: 'Pré-consulta Inteligente',
      description: 'Formulário completo com histórico, upload de imagens e análise por IA.',
      features: ['Histórico digital', 'Upload de imagens', 'Análise por IA'],
      image: 'images/landing/step-consultation.jpg',
      imageAlt: 'Médico analisando dados do paciente',
      details: [
        'Questionário adaptativo baseado na especialidade',
        'Upload de exames, fotos e documentos médicos',
        'Análise preliminar por inteligência artificial',
        'Organização automática do histórico médico',
        'Alertas de alergias e medicamentos em uso',
        'Preparação otimizada para a consulta especializada'
      ]
    },
    {
      number: '3',
      title: 'Atendimento no Polo',
      description: 'Acolhimento humanizado em consultórios equipados com tecnologia IoT de ponta.',
      features: ['Acolhimento humanizado', 'Equipamentos IoT', 'Suporte profissional'],
      image: 'images/landing/step-diagnosis.jpg',
      imageAlt: 'Profissional de saúde realizando atendimento',
      details: [
        'Recepção acolhedora com profissional de saúde local',
        'Ambiente confortável e tecnologicamente equipado',
        'Coleta de sinais vitais com dispositivos de última geração',
        'Transmissão segura de dados biométricos em tempo real',
        'Suporte contínuo durante todo o atendimento',
        'Ambiente climatizado e acessível para todos'
      ]
    },
    {
      number: '4',
      title: 'Consulta Especializada',
      description: 'Teleconsulta híbrida com dados biométricos em tempo real e insights de IA.',
      features: ['Especialista remoto', 'Dados em tempo real', 'Insights de IA'],
      image: 'images/landing/step-treatment.jpg',
      imageAlt: 'Médico realizando teleconsulta',
      details: [
        'Conexão em vídeo HD com especialista qualificado',
        'Visualização simultânea de todos os dados do paciente',
        'Exame físico assistido pelo profissional local',
        'Sugestões de diagnóstico baseadas em inteligência artificial',
        'Prescrição digital com assinatura certificada',
        'Encaminhamentos e solicitação de exames integrados'
      ]
    },
    {
      number: '5',
      title: 'Acompanhamento Contínuo',
      description: 'Prescrição digital, histórico completo e acompanhamento via app pessoal.',
      features: ['Prescrição digital', 'Histórico completo', 'Acompanhamento contínuo'],
      image: 'images/landing/step-monitoring.jpg',
      imageAlt: 'Paciente acompanhando tratamento pelo celular',
      details: [
        'Receitas digitais válidas em farmácias de todo Brasil',
        'Acesso ao prontuário completo pelo aplicativo',
        'Lembretes de medicamentos e retornos',
        'Monitoramento de evolução do tratamento',
        'Canal direto com equipe de saúde para dúvidas',
        'Integração com rede de farmácias populares'
      ]
    },
    {
      number: '6',
      title: 'Geração do Plano de Apoio ao Autocuidado',
      description: 'Plano personalizado com orientações, metas e acompanhamento para autogestão da saúde.',
      features: ['Plano personalizado', 'Metas de saúde', 'Autogestão orientada'],
      image: 'images/landing/step-selfcare.jpg',
      imageAlt: 'Paciente seguindo plano de autocuidado com orientações personalizadas',
      details: [
        'Plano de autocuidado gerado automaticamente após a consulta',
        'Orientações personalizadas baseadas no diagnóstico',
        'Metas diárias e semanais de saúde',
        'Dicas de alimentação, exercícios e bem-estar',
        'Alertas e lembretes para seguir o plano',
        'Acompanhamento de progresso pelo aplicativo'
      ]
    }
  ];

  openModal(step: Step): void {
    this.selectedModal = {
      icon: this.stepIcons[step.number] || '📋',
      title: step.title,
      description: step.description,
      details: step.details,
      color: 'primary'
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedModal = null;
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.onScroll(), 100);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('scroll', this.onScroll);
    }
  }

  private onScroll = (): void => {
    if (!this.timelineItems || this.timelineItems.length === 0) return;
    
    const viewportCenter = window.innerHeight / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    this.timelineItems.forEach((item, index) => {
      const rect = item.nativeElement.getBoundingClientRect();
      const itemCenter = rect.top + rect.height / 2;
      const distance = Math.abs(itemCenter - viewportCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    // Only update if the item is reasonably visible and activeStep changed
    const closestItem = this.timelineItems.get(closestIndex);
    if (closestItem) {
      const rect = closestItem.nativeElement.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        if (this.activeStep !== closestIndex) {
          this.ngZone.run(() => {
            this.activeStep = closestIndex;
            this.cdr.detectChanges();
          });
        }
      }
    }
  };

  isActiveStep(index: number): boolean {
    return this.activeStep === index;
  }
}
