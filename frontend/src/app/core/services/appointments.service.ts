import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { User } from './users.service';
import { Specialty } from './specialties.service';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type AppointmentType = 'first_visit' | 'return' | 'routine' | 'emergency' | 'common';

export interface PreConsultationForm {
  personalInfo: {
    fullName: string;
    birthDate: string;
    weight: string;
    height: string;
  };
  medicalHistory: {
    chronicConditions?: string;
    medications?: string;
    allergies?: string;
    surgeries?: string;
    generalObservations?: string;
  };
  lifestyleHabits: {
    smoker: 'sim' | 'nao' | 'ex-fumante';
    alcoholConsumption: 'nenhum' | 'social' | 'frequente';
    physicalActivity: 'nenhuma' | 'leve' | 'moderada' | 'intensa';
    generalObservations?: string;
  };
  vitalSigns: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    oxygenSaturation?: string;
    generalObservations?: string;
  };
  currentSymptoms: {
    mainSymptoms: string;
    symptomOnset: string;
    painIntensity?: number; // 0-10
    generalObservations?: string;
  };
  additionalObservations?: string;
  attachments?: {
    title: string;
    fileUrl: string; // Base64 or URL
    type: string;
  }[];
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  specialtyId: string;
  specialtyName: string;
  date: string; // ISO Date
  time: string; // HH:mm
  endTime?: string; // HH:mm
  type?: AppointmentType;
  status: AppointmentStatus;
  observation?: string;
  meetLink?: string;
  createdAt: string;
  updatedAt: string;
  avatar?: string; // For display purposes (patient or professional avatar depending on context)
  preConsultation?: PreConsultationForm;
}

export interface AppointmentsFilter {
  status?: AppointmentStatus | 'all' | 'upcoming' | 'past';
  search?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentsService {
  private mockAppointments: Appointment[] = [
    {
      id: '1',
      patientId: '1',
      patientName: 'João Silva',
      professionalId: '2',
      professionalName: 'Dr. Maria Santos',
      specialtyId: '1',
      specialtyName: 'Cardiologia',
      date: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(), // 2 days from now
      time: '14:00',
      endTime: '15:00',
      type: 'routine',
      status: 'scheduled',
      observation: 'Check-up de rotina',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      createdAt: '2024-03-01T10:00:00',
      updatedAt: '2024-03-01T10:00:00',
      avatar: 'assets/avatars/maria.jpg',
      preConsultation: {
        personalInfo: {
          fullName: 'João Silva',
          birthDate: '1980-05-15',
          weight: '75',
          height: '1.75'
        },
        medicalHistory: {
          chronicConditions: 'Hipertensão leve',
          medications: 'Losartana 50mg',
          allergies: 'Penicilina',
          surgeries: 'Apendicectomia (2010)'
        },
        lifestyleHabits: {
          smoker: 'nao',
          alcoholConsumption: 'social',
          physicalActivity: 'moderada'
        },
        vitalSigns: {
          bloodPressure: '120/80',
          heartRate: '72',
          temperature: '36.5',
          oxygenSaturation: '98'
        },
        currentSymptoms: {
          mainSymptoms: 'Cansaço ocasional após exercícios intensos',
          symptomOnset: '2 semanas atrás',
          painIntensity: 2
        }
      }
    },
    {
      id: '2',
      patientId: '1',
      patientName: 'João Silva',
      professionalId: '5',
      professionalName: 'Dr. Carlos Ferreira',
      specialtyId: '2',
      specialtyName: 'Dermatologia',
      date: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), // 5 days from now
      time: '09:00',
      endTime: '09:30',
      type: 'first_visit',
      status: 'confirmed',
      createdAt: '2024-03-05T15:30:00',
      updatedAt: '2024-03-06T09:00:00',
      avatar: 'assets/avatars/carlos.jpg'
    },
    {
      id: '3',
      patientId: '1',
      patientName: 'João Silva',
      professionalId: '2',
      professionalName: 'Dr. Maria Santos',
      specialtyId: '1',
      specialtyName: 'Cardiologia',
      date: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(), // 10 days ago
      time: '16:00',
      endTime: '16:45',
      type: 'return',
      status: 'completed',
      observation: 'Retorno',
      createdAt: '2024-02-20T11:00:00',
      updatedAt: '2024-02-20T11:00:00',
      avatar: 'assets/avatars/maria.jpg'
    },
    {
      id: '4',
      patientId: '1',
      patientName: 'João Silva',
      professionalId: '5',
      professionalName: 'Dr. Carlos Ferreira',
      specialtyId: '2',
      specialtyName: 'Dermatologia',
      date: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(), // 2 days ago
      time: '10:00',
      endTime: '10:30',
      type: 'common',
      status: 'cancelled',
      createdAt: '2024-03-10T08:00:00',
      updatedAt: '2024-03-11T14:00:00',
      avatar: 'assets/avatars/carlos.jpg'
    }
  ];

  getAppointments(filter: AppointmentsFilter = {}): Observable<Appointment[]> {
    return of(this.mockAppointments).pipe(
      delay(500),
      map(appointments => {
        let filtered = [...appointments];

        // Filter by status/time
        if (filter.status) {
            const now = new Date();
            if (filter.status === 'upcoming') {
                filtered = filtered.filter(a => new Date(a.date) >= now && a.status !== 'cancelled' && a.status !== 'completed');
            } else if (filter.status === 'past') {
                filtered = filtered.filter(a => new Date(a.date) < now || a.status === 'completed');
            } else if (filter.status !== 'all') {
                filtered = filtered.filter(a => a.status === filter.status);
            }
        }

        // Search
        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          filtered = filtered.filter(a => 
            a.professionalName.toLowerCase().includes(searchLower) ||
            a.specialtyName.toLowerCase().includes(searchLower) ||
            a.patientName.toLowerCase().includes(searchLower)
          );
        }

        // Sort by date (default desc)
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return filtered;
      })
    );
  }

  getAppointmentById(id: string): Observable<Appointment | undefined> {
    return of(this.mockAppointments.find(a => a.id === id)).pipe(delay(300));
  }

  cancelAppointment(id: string): Observable<boolean> {
    const index = this.mockAppointments.findIndex(a => a.id === id);
    if (index !== -1) {
      this.mockAppointments[index].status = 'cancelled';
      this.mockAppointments[index].updatedAt = new Date().toISOString();
      return of(true).pipe(delay(500));
    }
    return of(false);
  }

  savePreConsultation(appointmentId: string, data: PreConsultationForm): Observable<boolean> {
    const index = this.mockAppointments.findIndex(a => a.id === appointmentId);
    if (index !== -1) {
      this.mockAppointments[index].preConsultation = data;
      this.mockAppointments[index].updatedAt = new Date().toISOString();
      return of(true).pipe(delay(500));
    }
    return of(false);
  }
}
