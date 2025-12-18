import { Pipe, PipeTransform } from '@angular/core';
import { DayOfWeek } from '@app/core/services/schedules.service';

@Pipe({
  name: 'scheduleDays',
  standalone: true
})
export class ScheduleDaysPipe implements PipeTransform {
  private dayLabels: Record<DayOfWeek, string> = {
    'Monday': 'Seg',
    'Tuesday': 'Ter',
    'Wednesday': 'Qua',
    'Thursday': 'Qui',
    'Friday': 'Sex',
    'Saturday': 'Sáb',
    'Sunday': 'Dom'
  };

  private dayOrder: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  transform(daysConfig: any[]): string {
    if (!daysConfig || daysConfig.length === 0) {
      return 'Nenhum dia';
    }

    // Pegar apenas os dias que estão trabalhando
    const workingDays = daysConfig
      .filter(config => config.isWorking)
      .map(config => config.day)
      .sort((a, b) => this.dayOrder.indexOf(a as DayOfWeek) - this.dayOrder.indexOf(b as DayOfWeek));

    if (workingDays.length === 0) {
      return 'Nenhum dia';
    }

    // Se todos os 7 dias
    if (workingDays.length === 7) {
      return 'Semana inteira';
    }

    // Agrupar em intervalos contínuos
    const ranges = this.groupIntoRanges(workingDays as DayOfWeek[]);
    
    return ranges.map(range => this.formatRange(range)).join(', ');
  }

  private groupIntoRanges(days: DayOfWeek[]): DayOfWeek[][] {
    const ranges: DayOfWeek[][] = [];
    let currentRange: DayOfWeek[] = [days[0]];

    for (let i = 1; i < days.length; i++) {
      const currentIndex = this.dayOrder.indexOf(days[i]);
      const previousIndex = this.dayOrder.indexOf(days[i - 1]);

      // Se os dias são consecutivos
      if (currentIndex === previousIndex + 1) {
        currentRange.push(days[i]);
      } else {
        // Se não são consecutivos, inicia um novo range
        ranges.push(currentRange);
        currentRange = [days[i]];
      }
    }

    // Adicionar o último range
    ranges.push(currentRange);

    return ranges;
  }

  private formatRange(range: DayOfWeek[]): string {
    if (range.length === 1) {
      return this.dayLabels[range[0]];
    }

    // Se tem 2 dias consecutivos, mostrar só os extremos
    if (range.length === 2) {
      return `${this.dayLabels[range[0]]} - ${this.dayLabels[range[1]]}`;
    }

    // Se tem 3 ou mais dias, mostrar primeiro e último
    return `${this.dayLabels[range[0]]} - ${this.dayLabels[range[range.length - 1]]}`;
  }
}
