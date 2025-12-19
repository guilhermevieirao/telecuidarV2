import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, CurrencyPipe } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { StatCardComponent } from '@app/shared/components/atoms/stat-card/stat-card';
import { ReportsService, ReportFilter, ReportData, ExportFormat } from '@app/core/services/reports.service';

@Component({
  selector: 'app-reports',
  imports: [FormsModule, IconComponent, StatCardComponent, DecimalPipe, CurrencyPipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit {
  reportData: ReportData | null = null;
  isLoading = false;
  isExporting = false;

  // Filtros
  startDate = '';
  endDate = '';

  // Dropdowns
  isExportDropdownOpen = false;

  private reportsService = inject(ReportsService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // Definir data padrão: último mês
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    this.endDate = this.formatDateForInput(today);
    this.startDate = this.formatDateForInput(lastMonth);
  }

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    const filter: ReportFilter = {
      startDate: this.startDate,
      endDate: this.endDate
    };

    this.reportsService.getReportData(filter).subscribe({
      next: (data) => {
        this.reportData = data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onFilterChange(): void {
    this.loadReport();
  }

  onExport(format: ExportFormat): void {
    this.isExporting = true;
    this.isExportDropdownOpen = false;
    this.cdr.markForCheck();

    const filter: ReportFilter = {
      startDate: this.startDate,
      endDate: this.endDate
    };

    this.reportsService.exportReport(filter, format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        link.download = `relatorio-${new Date().toISOString()}.${extension}`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.isExporting = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isExporting = false;
        this.cdr.markForCheck();
      }
    });
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getTopSpecialty(): string {
    if (!this.reportData || this.reportData.specialtiesRanking.length === 0) {
      return '-';
    }
    return this.reportData.specialtiesRanking[0].specialty;
  }
}
