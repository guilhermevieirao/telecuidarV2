import { Routes } from '@angular/router';
import { LandingComponent } from '@pages/landing/landing';
import { LoginComponent } from '@pages/auth/login/login';
import { RegisterComponent } from '@pages/auth/register/register';
import { ForgotPasswordComponent } from '@pages/auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from '@pages/auth/reset-password/reset-password';
import { VerifyEmailComponent } from '@pages/auth/verify-email/verify-email';

// Shared user components
import { UserLayoutComponent } from '@pages/user/shared/user-layout/user-layout';
import { DashboardComponent } from '@pages/user/shared/dashboard/dashboard';
import { NotificationsComponent } from '@pages/user/shared/notifications/notifications';
import { ProfileComponent } from '@pages/user/shared/profile/profile';
import { AppointmentsComponent } from '@pages/user/shared/appointments/appointments';

import { ScheduleBlocksComponent as ProfessionalScheduleBlocksComponent } from '@pages/user/shared/schedule-blocks/schedule-blocks';
import { MyScheduleComponent } from '@pages/user/professional/my-schedule/my-schedule';

// Admin-specific components
import { UsersComponent } from '@pages/user/admin/users/users';
import { InvitesComponent } from '@pages/user/admin/invites/invites';
import { SpecialtiesComponent } from '@pages/user/admin/specialties/specialties';
import { SchedulesComponent } from '@pages/user/admin/schedules';
import { ScheduleBlocksComponent as AdminScheduleBlocksComponent } from '@pages/user/admin/schedule-blocks';
import { ReportsComponent } from '@pages/user/admin/reports/reports';
import { AuditLogsComponent } from '@pages/user/admin/audit-logs/audit-logs';

// Patient-specific components
import { SchedulingComponent } from '@pages/user/patient/scheduling/scheduling';
import { SchedulingSuccessComponent } from '@pages/user/patient/scheduling-success/scheduling-success';
import { PreConsultationComponent } from '@pages/user/patient/pre-consultation/pre-consultation';
import { MobileUploadComponent } from '@pages/mobile-upload/mobile-upload';

import { TeleconsultationComponent } from '@pages/user/shared/teleconsultation/teleconsultation';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent
  },
  {
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
      { path: 'verify-email', component: VerifyEmailComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  {
    path: 'mobile-upload',
    component: MobileUploadComponent
  },
  {
    path: 'admin',
    component: UserLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'users', component: UsersComponent },
      { path: 'invites', component: InvitesComponent },
      { path: 'specialties', component: SpecialtiesComponent },
      { path: 'schedules', component: SchedulesComponent },
      { path: 'schedule-blocks', component: AdminScheduleBlocksComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'audit-logs', component: AuditLogsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'patient',
    component: UserLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'appointments', component: AppointmentsComponent },
      { path: 'scheduling', component: SchedulingComponent },
      { path: 'scheduling/success', component: SchedulingSuccessComponent },
      { path: 'appointments/:id/pre-consultation', component: PreConsultationComponent },
      { path: 'teleconsultation/:id', component: TeleconsultationComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'professional',
    component: UserLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'appointments', component: AppointmentsComponent },
      { path: 'schedule-blocks', component: ProfessionalScheduleBlocksComponent },
      { path: 'my-schedule', component: MyScheduleComponent },
      { path: 'teleconsultation/:id', component: TeleconsultationComponent },
      // Future professional-specific routes will go here
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];
