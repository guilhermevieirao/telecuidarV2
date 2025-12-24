import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { IconComponent } from '@app/shared/components/atoms/icon/icon';
import { StatCardComponent } from '@app/shared/components/atoms/stat-card/stat-card';
import { ReportsService, ReportFilter, ReportData, ExportFormat } from '@app/core/services/reports.service';
import { RealTimeService, DashboardUpdateNotification } from '@app/core/services/real-time.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-reports',
  imports: [FormsModule, IconComponent, StatCardComponent, DecimalPipe, CurrencyPipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class ReportsComponent implements OnInit, OnDestroy {
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
  private realTimeService = inject(RealTimeService);
  private realTimeSubscriptions: Subscription[] = [];
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    // Definir data padrão: último mês
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    this.endDate = this.formatDateForInput(today);
    this.startDate = this.formatDateForInput(lastMonth);
  }

  ngOnInit(): void {
    this.loadReport();
    if (this.isBrowser) {
      this.setupRealTimeSubscriptions();
    }
  }

  ngOnDestroy(): void {
    this.realTimeSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupRealTimeSubscriptions(): void {
    // Escutar atualizações do dashboard que podem afetar os relatórios
    const dashboardSub = this.realTimeService.dashboardUpdated$.subscribe(
      (notification: DashboardUpdateNotification) => {
        // Recarregar relatório quando houver mudanças em dados relevantes
        this.loadReport();
      }
    );
    this.realTimeSubscriptions.push(dashboardSub);
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
