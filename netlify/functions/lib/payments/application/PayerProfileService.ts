import { PaymentError } from '../domain/errors';
import { payerProfilePersistenceAvailable } from '../infrastructure/payerProfileCrypto';
import {
  deletePayerProfile,
  findPayerProfile,
  upsertPayerProfile,
  type PayerProfileData,
} from '../repositories/PayerProfileRepository';
import type { Payer } from '../providers/PaymentProvider';

type PayerProfileRepository = {
  find: (userId: string) => Promise<PayerProfileData | null>;
  upsert: (userId: string, profile: PayerProfileData) => Promise<PayerProfileData | null>;
  delete: (userId: string) => Promise<boolean>;
};

type PayerProfileDependencies = {
  persistenceAvailable?: () => boolean;
  repository?: PayerProfileRepository;
};

const defaultRepository: PayerProfileRepository = {
  find: findPayerProfile,
  upsert: upsertPayerProfile,
  delete: deletePayerProfile,
};

export class PayerProfilePersistenceUnavailableError extends PaymentError {
  constructor() {
    super(
      'PAYER_PROFILE_PERSISTENCE_UNAVAILABLE',
      'O armazenamento seguro de dados do pagador está indisponível.',
      503,
    );
  }
}

class PayerProfilePersistenceFailedError extends PaymentError {
  constructor() {
    super(
      'PAYER_PROFILE_PERSISTENCE_FAILED',
      'Não foi possível armazenar os dados do pagador agora.',
      503,
    );
  }
}

/** Owner-keyed encrypted payer-profile use cases. */
export class PayerProfileService {
  private readonly persistenceAvailable: () => boolean;
  private readonly repository: PayerProfileRepository;

  constructor(dependencies: PayerProfileDependencies = {}) {
    this.persistenceAvailable = dependencies.persistenceAvailable ?? payerProfilePersistenceAvailable;
    this.repository = dependencies.repository ?? defaultRepository;
  }

  async get(userId: string): Promise<{ persistenceAvailable: boolean; profile: PayerProfileData | null }> {
    if (!this.persistenceAvailable()) return { persistenceAvailable: false, profile: null };
    try {
      return { persistenceAvailable: true, profile: await this.repository.find(userId) };
    } catch {
      // A ciphertext/key inconsistency must fail closed and never surface PII.
      console.error('[payments] PAYER_PROFILE_READ_UNAVAILABLE');
      return { persistenceAvailable: false, profile: null };
    }
  }

  async upsert(userId: string, profile: PayerProfileData): Promise<PayerProfileData> {
    if (!this.persistenceAvailable()) throw new PayerProfilePersistenceUnavailableError();
    try {
      const saved = await this.repository.upsert(userId, profile);
      if (!saved) throw new PayerProfilePersistenceFailedError();
      return saved;
    } catch (error) {
      if (error instanceof PayerProfilePersistenceFailedError) throw error;
      if (!this.persistenceAvailable()) throw new PayerProfilePersistenceUnavailableError();
      // Repository/provider error strings can include bound values; keep the
      // application boundary deliberately non-sensitive.
      throw new PayerProfilePersistenceFailedError();
    }
  }

  async delete(userId: string): Promise<boolean> {
    // Deletion remains available even if a rotated/missing key prevents reads.
    try {
      return await this.repository.delete(userId);
    } catch {
      throw new PayerProfilePersistenceFailedError();
    }
  }

  async saveFromCharge(userId: string, payer: Payer): Promise<void> {
    if (
      !payer.firstName || !payer.lastName || !payer.identification || !payer.address ||
      !payer.address.neighborhood || !payer.address.city || !payer.address.state
    ) {
      throw new Error('Payer profile data is incomplete.');
    }
    await this.upsert(userId, {
      firstName: payer.firstName,
      lastName: payer.lastName,
      email: payer.email,
      phone: payer.phone,
      identification: payer.identification,
      address: {
        zipCode: payer.address.zipCode,
        streetName: payer.address.streetName,
        streetNumber: payer.address.streetNumber,
        neighborhood: payer.address.neighborhood,
        city: payer.address.city,
        state: payer.address.state,
        complement: payer.address.complement,
      },
    });
  }
}

let cached: PayerProfileService | null = null;

export function getPayerProfileService(): PayerProfileService {
  return (cached ??= new PayerProfileService());
}

export function setPayerProfileServiceForTesting(service: PayerProfileService | null): void {
  cached = service;
}
