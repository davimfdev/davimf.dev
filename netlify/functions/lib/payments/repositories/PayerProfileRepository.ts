import {
  decryptPayerProfileSensitive,
  encryptPayerProfileSensitive,
  type PayerProfileSensitiveData,
} from '../infrastructure/payerProfileCrypto';
import { paymentsSql, str, type SqlRow } from '../infrastructure/db';

/** Reusable payer data: name/email remain queryable; all other PII is encrypted at rest. */
export type PayerProfileData = PayerProfileSensitiveData & {
  firstName: string;
  lastName: string;
  email: string;
};

function rowToPayerProfile(row: SqlRow): PayerProfileData {
  return {
    firstName: str(row.first_name),
    lastName: str(row.last_name),
    email: str(row.email),
    ...decryptPayerProfileSensitive(str(row.sensitive_ciphertext)),
  };
}

/** Finds only the profile owned by the authenticated user id supplied by the caller. */
export async function findPayerProfile(userId: string): Promise<PayerProfileData | null> {
  const rows = await paymentsSql`
    SELECT first_name, last_name, email, sensitive_ciphertext, cipher_version
      FROM payer_profiles
     WHERE user_id = ${userId}
     LIMIT 1`;
  return rows[0] ? rowToPayerProfile(rows[0]) : null;
}

/** Creates or replaces one owner's complete encrypted payer profile. */
export async function upsertPayerProfile(userId: string, data: PayerProfileData): Promise<PayerProfileData | null> {
  const sensitiveCiphertext = encryptPayerProfileSensitive({
    phone: data.phone,
    identification: data.identification,
    address: data.address,
  });
  const rows = await paymentsSql`
    INSERT INTO payer_profiles (
      user_id, first_name, last_name, email, sensitive_ciphertext
    ) VALUES (
      ${userId}, ${data.firstName}, ${data.lastName}, ${data.email}, ${sensitiveCiphertext}
    )
    ON CONFLICT (user_id) DO UPDATE
      SET first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          email = EXCLUDED.email,
          sensitive_ciphertext = EXCLUDED.sensitive_ciphertext,
          cipher_version = 1,
          updated_at = now()
    RETURNING first_name, last_name, email, sensitive_ciphertext, cipher_version`;
  return rows[0] ? rowToPayerProfile(rows[0]) : null;
}

/** Removes only the profile for the supplied owner id. */
export async function deletePayerProfile(userId: string): Promise<boolean> {
  const rows = await paymentsSql`
    DELETE FROM payer_profiles
     WHERE user_id = ${userId}
    RETURNING user_id`;
  return rows.length > 0;
}
