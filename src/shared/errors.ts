export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class PatientNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'PATIENT_NOT_FOUND';

  constructor(identifier: string) {
    super(`Patient not found: ${identifier}`);
  }
}

export class DoctorNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'DOCTOR_NOT_FOUND';

  constructor(identifier: string) {
    super(`Doctor not found: ${identifier}`);
  }
}

export class SlotNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'SLOT_NOT_FOUND';

  constructor(identifier: string) {
    super(`Slot not found: ${identifier}`);
  }
}

export class SlotAlreadyBookedError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'SLOT_ALREADY_BOOKED';

  constructor(identifier: string) {
    super(`Slot already booked: ${identifier}`);
  }
}

export class AppointmentNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'APPOINTMENT_NOT_FOUND';

  constructor(identifier: string) {
    super(`Appointment not found: ${identifier}`);
  }
}

export class AppointmentAlreadyCancelledError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'APPOINTMENT_ALREADY_CANCELLED';

  constructor(identifier: string) {
    super(`Appointment already cancelled: ${identifier}`);
  }
}

export class PaymentConfigNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'PAYMENT_CONFIG_NOT_FOUND';

  constructor(identifier: string) {
    super(`Payment config not found: ${identifier}`);
  }
}
