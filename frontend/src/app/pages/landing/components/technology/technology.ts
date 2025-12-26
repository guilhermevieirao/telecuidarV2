import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TechCategory {
  icon: string;
  title: string;
  items: string[];
}

@Component({
  selector: 'app-technology',
  imports: [CommonModule],
  templateUrl: './technology.html',
  styleUrl: './technology.scss'
})
export class TechnologyComponent {
  categories: TechCategory[] = [
    {
      icon: '🏥',
      title: 'Integração com Datasus',
      items: [
        'Validação do Cartão Nacional de Saúde (CNS)',
        'Interoperabilidade com sistemas do SUS',
        'Cadastro unificado de pacientes',
        'Conformidade com padrões nacionais de saúde'
      ]
    },
    {
      icon: '💉',
      title: 'Dispositivos Biométricos',
      items: [
        'Estetoscópios digitais de alta precisão',
        'Monitores de pressão arterial conectados',
        'Oxímetros e termômetros inteligentes',
        'Dispositivos de ECG portáteis'
      ]
    },
    {
      icon: '💻',
      title: 'Plataforma de Teleconsulta',
      items: [
        'Videochamada HD com baixa latência',
        'Prontuário eletrônico integrado',
        'Painel de dados vitais em tempo real',
        'Prontuário eletrônico completo'
      ]
    },
    {
      icon: '🧠',
      title: 'Análise Inteligente por IA',
      items: [
        'Análise de séries históricas de saúde',
        'Detecção de padrões anômalos',
        'Sugestões de diagnóstico diferencial',
        'Alertas de risco automatizados'
      ]
    }
  ];
}
