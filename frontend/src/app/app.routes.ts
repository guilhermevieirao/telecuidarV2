import { Routes } from '@angular/router';
import { LandingComponent } from '@pages/landing/landing';
import { LoginComponent } from '@pages/auth/login/login';
import { RegisterComponent } from '@pages/auth/register/register';
import { ForgotPasswordComponent } from '@pages/auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from '@pages/auth/reset-password/reset-password';
import { VerifyEmailComponent } from '@pages/auth/verify-email/verify-email';
import { VerifyEmailChangeComponent } from '@pages/auth/verify-email-change/verify-email-change';

// Legal pages
import { TermsComponent } from '@pages/legal/terms/terms';
import { PrivacyComponent } from '@pages/legal/privacy/privacy';
import { LgpdComponent } from '@pages/legal/lgpd/lgpd';

// Shared user components
import { UserLayoutComponent } from '@pages/user/shared/user-layout/user-layout';
import { DashboardComponent } from '@pages/user/shared/dashboard/dashboard';
import { NotificationsComponent } from '@pages/user/shared/notifications/notifications';
import { ProfileComponent } from '@pages/user/shared/profile/profile';
import { AppointmentsComponent } from '@pages/user/shared/appointments/appointments';
import { AppointmentDetailsModalComponent } from '@pages/user/shared/appointments/appointment-details-modal/appointment-details-modal';
import { AppointmentDetailsComponent } from '@pages/user/shared/appointments/appointment-details/appointment-details';
import { ScheduleBlocksComponent } from '@pages/user/shared/schedule-blocks/schedule-blocks';
import { MyScheduleComponent } from '@pages/user/professional/my-schedule/my-schedule';
import { CertificatesComponent } from '@pages/user/professional/certificates/certificates';

// Admin-specific components
import { ScheduleBlocksComponent as AdminScheduleBlocksComponent } from '@pages/user/admin/schedule-blocks/schedule-blocks';
import { UsersComponent } from '@pages/user/admin/users/users';
import { InvitesComponent } from '@pages/user/admin/invites/invites';
import { SpecialtiesComponent } from '@pages/user/admin/specialties/specialties';
import { SchedulesComponent } from '@pages/user/admin/schedules';
import { ReportsComponent } from '@pages/user/admin/reports/reports';
import { AuditLogsComponent } from '@pages/user/admin/audit-logs/audit-logs';

// Patient-specific components
import { SchedulingComponent } from '@pages/user/patient/scheduling/scheduling';
import { SchedulingSuccessComponent } from '@pages/user/patient/scheduling-success/scheduling-success';
import { PreConsultationComponent } from '@pages/user/patient/pre-consultation/pre-consultation';
import { MobileUploadComponent } from '@pages/mobile-upload/mobile-upload';

// Assistant-specific components
import { DigitalOfficeComponent } from '@pages/user/assistant/digital-office/digital-office';

import { TeleconsultationComponent } from '@pages/user/shared/teleconsultation/teleconsultation';

// Panel components (new design)
import { PanelRouterComponent } from '@pages/user/shared/panel-router/panel-router';

// Guards
import { authGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';
import { guestGuard } from '@core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent
  },
  { path: 'termos', component: TermsComponent },
  { path: 'privacidade', component: PrivacyComponent },
  { path: 'lgpd', component: LgpdComponent },
  { path: 'entrar', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'registrar', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'esqueci-senha', component: ForgotPasswordComponent },
  { path: 'redefinir-senha', component: ResetPasswordComponent },
  { path: 'verificar-email', component: VerifyEmailComponent },
  { path: 'verificar-alteracao-email', component: VerifyEmailChangeComponent },
  // Rotas legadas para compatibilidade
  { path: 'reset-password', redirectTo: '/redefinir-senha', pathMatch: 'full' },
  { path: 'auth/verify-email', redirectTo: '/verificar-email', pathMatch: 'full' },
  { path: 'auth/verify-email-change', redirectTo: '/verificar-alteracao-email', pathMatch: 'full' },
  { path: 'auth/reset-password', redirectTo: '/redefinir-senha', pathMatch: 'full' },
  { path: 'auth/forgot-password', redirectTo: '/esqueci-senha', pathMatch: 'full' },
  { path: 'auth', redirectTo: '/entrar', pathMatch: 'full' },
  {
    path: 'mobile-upload',
    component: MobileUploadComponent
  },
  // Full screen panel - routes to correct panel based on user role
  {
    path: 'painel',
    component: PanelRouterComponent,
    canActivate: [authGuard]
  },
  {
    path: '',
    component: UserLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'notificacoes', component: NotificationsComponent },
      { path: 'perfil', component: ProfileComponent },
      { path: 'consultas', component: AppointmentsComponent },
      { path: 'consultas/:id/detalhes', component: AppointmentDetailsComponent },
      
      // Admin only
      { path: 'usuarios', component: UsersComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'convites', component: InvitesComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'especialidades', component: SpecialtiesComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'agendas', component: SchedulesComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'solicitacoes-bloqueio', component: AdminScheduleBlocksComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'relatorios', component: ReportsComponent, canActivate: [roleGuard(['ADMIN'])] },
      { path: 'logs-auditoria', component: AuditLogsComponent, canActivate: [roleGuard(['ADMIN'])] },
      
      // Professional only
      { path: 'bloqueios-agenda', component: ScheduleBlocksComponent, canActivate: [roleGuard(['PROFESSIONAL'])] },
      { path: 'minha-agenda', component: MyScheduleComponent, canActivate: [roleGuard(['PROFESSIONAL'])] },
      { path: 'certificados', component: CertificatesComponent, canActivate: [roleGuard(['PROFESSIONAL'])] },
      
      // Patient only
      { path: 'agendar', component: SchedulingComponent, canActivate: [roleGuard(['PATIENT'])] },
      { path: 'agendamento-sucesso', component: SchedulingSuccessComponent, canActivate: [roleGuard(['PATIENT'])] },
      { path: 'consultas/:id/pre-consulta', component: PreConsultationComponent, canActivate: [roleGuard(['PATIENT'])] },
      
      // Assistant only
      { path: 'consultorio-digital', component: DigitalOfficeComponent, canActivate: [roleGuard(['ASSISTANT'])] },
      
      // Teleconsultation (all authenticated users)
      { path: 'teleconsulta/:id', component: TeleconsultationComponent }
    ]
  }
];
