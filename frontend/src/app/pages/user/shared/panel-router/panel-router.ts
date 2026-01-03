import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';

// Import all panel components
import { AdminPanelComponent } from '@pages/user/admin/admin-panel/admin-panel';
import { PatientPanelComponent } from '@pages/user/patient/patient-panel/patient-panel';
import { ProfessionalPanelComponent } from '@pages/user/professional/professional-panel/professional-panel';
import { AssistantPanelComponent } from '@pages/user/assistant/assistant-panel/assistant-panel';

@Component({
  selector: 'app-panel-router',
  standalone: true,
  imports: [
    AdminPanelComponent,
    PatientPanelComponent,
    ProfessionalPanelComponent,
    AssistantPanelComponent
  ],
  template: `
    @switch (userRole) {
      @case ('ADMIN') {
        <app-admin-panel />
      }
      @case ('PATIENT') {
        <app-patient-panel />
      }
      @case ('PROFESSIONAL') {
        <app-professional-panel />
      }
      @case ('ASSISTANT') {
        <app-assistant-panel />
      }
      @default {
        <div class="loading">Carregando...</div>
      }
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-size: 1.5rem;
      color: #64748b;
    }
  `]
})
export class PanelRouterComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  userRole: string = '';

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.userRole = user.role;
    } else {
      this.router.navigate(['/entrar']);
    }
  }
}
