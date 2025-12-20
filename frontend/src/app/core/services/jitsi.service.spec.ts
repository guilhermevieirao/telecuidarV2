import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { JitsiService, JitsiConfig, JitsiToken } from './jitsi.service';

// Mock environment
const mockApiUrl = 'http://localhost:5239/api';

describe('JitsiService', () => {
  let service: JitsiService;
  let httpMock: HttpTestingController;

  const mockConfig: JitsiConfig = {
    enabled: true,
    domain: 'jitsi.test.com',
    requiresAuth: true
  };

  const mockToken: JitsiToken = {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    roomName: 'telecuidar-test-room',
    domain: 'jitsi.test.com',
    displayName: 'Dr. Test',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
    isModerator: true,
    expiresAt: Date.now() + 7200000
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [JitsiService]
    });
    service = TestBed.inject(JitsiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.dispose();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getConfig', () => {
    it('should fetch Jitsi configuration', () => {
      service.getConfig().subscribe(config => {
        expect(config).toEqual(mockConfig);
        expect(config.enabled).toBe(true);
        expect(config.domain).toBe('jitsi.test.com');
      });

      const req = httpMock.expectOne(req => req.url.includes('/jitsi/config'));
      expect(req.request.method).toBe('GET');
      req.flush(mockConfig);
    });
  });

  describe('getToken', () => {
    it('should fetch JWT token for appointment', () => {
      const appointmentId = 'test-appointment-id';

      service.getToken(appointmentId).subscribe(token => {
        expect(token).toEqual(mockToken);
        expect(token.isModerator).toBe(true);
        expect(token.roomName).toContain('telecuidar');
      });

      const req = httpMock.expectOne(req => req.url.includes(`/jitsi/token/${appointmentId}`));
      expect(req.request.method).toBe('GET');
      req.flush(mockToken);
    });
  });

  describe('validateAccess', () => {
    it('should validate user access to room', () => {
      const appointmentId = 'test-appointment-id';

      service.validateAccess(appointmentId).subscribe(hasAccess => {
        expect(hasAccess).toBe(true);
      });

      const req = httpMock.expectOne(req => req.url.includes(`/jitsi/validate/${appointmentId}`));
      expect(req.request.method).toBe('GET');
      req.flush({ hasAccess: true });
    });

    it('should return false on error', () => {
      const appointmentId = 'test-appointment-id';

      service.validateAccess(appointmentId).subscribe(hasAccess => {
        expect(hasAccess).toBe(false);
      });

      const req = httpMock.expectOne(req => req.url.includes(`/jitsi/validate/${appointmentId}`));
      req.error(new ProgressEvent('error'));
    });
  });

  describe('callState$', () => {
    it('should have initial state', (done) => {
      service.callState$.subscribe(state => {
        expect(state.isConnected).toBe(false);
        expect(state.isLoading).toBe(false);
        expect(state.isMuted).toBe(false);
        expect(state.isVideoOff).toBe(false);
        expect(state.participantCount).toBe(0);
        expect(state.error).toBeNull();
        done();
      });
    });
  });

  describe('dispose', () => {
    it('should reset call state', () => {
      service.dispose();
      
      service.callState$.subscribe(state => {
        expect(state.isConnected).toBe(false);
        expect(state.error).toBeNull();
      });
    });

    it('should report not active after dispose', () => {
      service.dispose();
      expect(service.isActive()).toBe(false);
    });
  });

  describe('control methods', () => {
    it('should not throw when calling controls without active call', () => {
      expect(() => service.toggleAudio()).not.toThrow();
      expect(() => service.toggleVideo()).not.toThrow();
      expect(() => service.toggleScreenShare()).not.toThrow();
      expect(() => service.openChat()).not.toThrow();
      expect(() => service.muteEveryone()).not.toThrow();
      expect(() => service.hangup()).not.toThrow();
    });
  });
});
