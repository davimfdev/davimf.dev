import type { LegalContent } from './types';
import { legalPt } from './pt';

/**
 * A identificação da empresa é a mesma nos dois idiomas: razão social e CNPJ
 * são nomes próprios registrados, não se traduzem.
 */
const COMPANY = legalPt.company;

const IDENTIFICATION = `${COMPANY.name}, registered under CNPJ no. ${COMPANY.cnpj}, at ${COMPANY.address}`;

const UPDATED_AT = 'August 28, 2026';

export const legalEn: LegalContent = {
  company: COMPANY,

  privacy: {
    title: 'Privacy Policy',
    updatedAt: `Last updated: ${UPDATED_AT}`,
    summary:
      'How we collect, use, share and protect your personal data, and how you exercise your rights.',
    sections: [
      {
        heading: 'Who the controller is',
        paragraphs: [
          `The controller of the personal data processed on this site is ${IDENTIFICATION}.`,
          `To exercise any right described in this policy, or to ask about how your data is handled, write to ${COMPANY.privacyEmail}.`,
        ],
      },
      {
        heading: 'Data we collect',
        paragraphs: ['We collect only what is needed for the features you choose to use:'],
        bullets: [
          'Account: signing in with Discord gives us your identifier, username, avatar and email address.',
          'Purchase: first and last name, email, tax ID (CPF or CNPJ) and phone. For bank slips, also postcode, street, number, district, city and state.',
          'Payment: method, status, amount and — for cards — only the brand and the last four digits.',
          'Site usage: audience metrics, only if you consent to analytics cookies.',
          'Support: the content of the messages you send us.',
        ],
      },
      {
        heading: 'Card data never reaches us',
        paragraphs: [
          'The card number, expiry date and security code are typed into fields hosted by Mercado Pago and turned into a token inside your own browser. Our server only ever receives that single-use token.',
          'At no point do we store, log or have access to the full card number or the security code.',
        ],
      },
      {
        heading: 'Why we process it, and on what legal basis',
        paragraphs: ['Each processing activity has a legal basis under the LGPD (Law 13.709/2018):'],
        bullets: [
          'Performance of a contract (art. 7, V): processing the purchase, delivering the licence, providing support and managing subscriptions.',
          'Legal and regulatory obligation (art. 7, II): retention of tax and accounting records of the sale.',
          'Legitimate interest (art. 7, IX): fraud prevention and operational security, including the device identifier sent to Mercado Pago with the charge.',
          'Consent (art. 7, I): audience analytics cookies, which load only after you accept.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'We do not sell your data and we do not use it for third-party advertising. We share it only with the parties needed to run the service, acting as processors:',
        ],
        bullets: [
          'Mercado Pago: payment processing and fraud prevention. Receives the payer data required to authorise the charge.',
          'Resend: delivery of the transactional emails confirming the purchase and sending the licence.',
          'Discord: authenticating your account when you choose to sign in with it.',
          'Infrastructure provider: hosting of the site and the database.',
        ],
      },
      {
        heading: 'Cookies and similar technologies',
        paragraphs: [
          'We use strictly necessary cookies to keep you signed in and to protect the payment form. They do not require consent because the site cannot work without them.',
          'We also use audience analytics cookies (Google Analytics), which load only after you accept the notice shown on your first visit. If you decline, the script is never loaded.',
          'You can change your mind at any time through the "Cookie preferences" link in the footer. Withdrawing is as easy as accepting.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'Account data is kept while your account exists. Purchase and payment records are kept for the period required by tax law, even after the account is closed, because that retention is a legal obligation.',
          'Billing details you choose to save are stored encrypted until you remove them.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: ['Article 18 of the LGPD guarantees you, at any time:'],
        bullets: [
          'confirmation that we process your data, and access to it;',
          'correction of incomplete, inaccurate or outdated data;',
          'anonymisation, blocking or deletion of unnecessary data or data processed unlawfully;',
          'portability of your data to another provider;',
          'deletion of data processed on the basis of your consent;',
          'information about who we share your data with;',
          'withdrawal of consent, at any time.',
        ],
      },
      {
        heading: 'How to exercise your rights',
        paragraphs: [
          `Send your request to ${COMPANY.privacyEmail}. We answer as quickly as we can and, in any case, within the deadlines set by the LGPD.`,
          'Some data cannot be deleted on request while the legal obligation to retain the tax records of a purchase is still in force. In that case we will tell you which data remains and why.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'All site traffic is encrypted in transit. Licence keys and saved billing details are stored encrypted. Administrative access is restricted and logged.',
          'No system is immune to incidents. Should a security incident occur with relevant risk to you, we will notify both you and the ANPD, as required by article 48 of the LGPD.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'We may update this policy to reflect changes to the service or to the law. The last update date is always shown at the top of this page, and material changes will be announced through our channels.',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    updatedAt: `Last updated: ${UPDATED_AT}`,
    summary: 'The rules governing your use of the site and your purchase of licences.',
    sections: [
      {
        heading: 'Who you are contracting with',
        paragraphs: [
          `The products and services on this site are provided by ${IDENTIFICATION}.`,
          'By using the site or making a purchase you agree to these Terms. If you do not agree, please do not use the service.',
        ],
      },
      {
        heading: 'What is being sold',
        paragraphs: [
          'We sell software licences. A purchase grants you a personal, non-transferable activation key for the period stated on the product, and transfers neither ownership of the software nor any copyright in it.',
          'The software installer is distributed free of charge. What you buy is the licence that enables it.',
        ],
      },
      {
        heading: 'Account and registration',
        paragraphs: [
          'Some features require an account, created by signing in with Discord. You are responsible for the accuracy of the information you provide and for keeping access to your account secure.',
          'The billing details you enter at checkout must be true and your own. Incorrect details may prevent the card issuer from authorising the payment.',
        ],
      },
      {
        heading: 'Prices and payment',
        paragraphs: [
          'Prices are in Brazilian reais (BRL) and are those displayed at the time of purchase. We accept Pix, credit card and bank slip, processed by Mercado Pago.',
          'We may change prices at any time, but a change never affects a purchase already completed.',
        ],
      },
      {
        heading: 'Delivery',
        paragraphs: [
          'The licence is released automatically once payment is confirmed. With Pix and approved cards this usually happens within moments; with a bank slip, after the payment clears, which may take a few business days.',
          'The key is available in the "My keys" area of your account and is also sent by email. If the email does not arrive, the key remains retrievable on the site.',
        ],
      },
      {
        heading: 'What you may and may not do',
        paragraphs: ['The licence is granted for your own use. You may not:'],
        bullets: [
          'resell, sublicense, rent or assign the licence or the activation key;',
          'share the key with third parties or publish it;',
          'reverse engineer, decompile or attempt to circumvent the licensing mechanism;',
          'use the software for any unlawful purpose.',
        ],
      },
      {
        heading: 'Support and availability',
        paragraphs: [
          'We provide support through the channels listed on the site during business hours. We work to keep the service available, but do not guarantee uninterrupted operation: maintenance, third-party failures and force majeure may cause temporary unavailability.',
        ],
      },
      {
        heading: 'Cancellation and refunds',
        paragraphs: [
          'You have a 7-day right of withdrawal under article 49 of the Brazilian Consumer Protection Code. The conditions, deadlines and procedure are set out in our Refund Policy.',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: [
          'We are liable for defects in the product under the Brazilian Consumer Protection Code. Nothing in these Terms excludes or limits rights the law grants to consumers.',
          'We are not liable for damage arising from misuse of the software, from changes made by you or by third parties, or from unavailability of third-party services outside our control.',
        ],
      },
      {
        heading: 'Changes to these Terms',
        paragraphs: [
          'We may change these Terms at any time. The last update date is shown at the top of this page. Changes do not apply retroactively to purchases already completed.',
        ],
      },
      {
        heading: 'Governing law and jurisdiction',
        paragraphs: [
          "These Terms are governed by Brazilian law. The courts of the consumer's domicile are elected to settle disputes, as provided by the Consumer Protection Code.",
        ],
      },
    ],
  },

  refund: {
    title: 'Refund Policy',
    updatedAt: `Last updated: ${UPDATED_AT}`,
    summary: 'Your right of withdrawal, how to request a refund, and what happens to the licence.',
    sections: [
      {
        heading: 'Right of withdrawal: 7 days',
        paragraphs: [
          'Because the purchase is made outside a physical place of business, you may withdraw from it within 7 calendar days of the purchase date, under article 49 of the Brazilian Consumer Protection Code.',
          'Within that window you do not need to give a reason, and the amount paid is refunded in full.',
        ],
      },
      {
        heading: 'How to request',
        paragraphs: [
          `Send a request to ${COMPANY.privacyEmail} with your account email and the order number. The order number is in your purchase confirmation email and in the "My orders" area.`,
          'We confirm receipt and process the refund through the same payment method used for the purchase.',
        ],
      },
      {
        heading: 'Refund timing',
        paragraphs: [
          'We request the refund from Mercado Pago as soon as we approve it. How long the money takes to reach you depends on the payment method: Pix is usually quick, while a credit card refund appears on the current or the following statement, depending on your issuer.',
          "That final timing belongs to your card issuer and to Mercado Pago, and is outside our control.",
        ],
      },
      {
        heading: 'What happens to the licence',
        paragraphs: [
          'On a full refund, the licence key for that order is revoked and stops working. On a partial refund, the key is suspended.',
          'This is the natural counterpart of the refund: the money returns to you and the product stops being usable.',
        ],
      },
      {
        heading: 'After the 7 days',
        paragraphs: [
          'Once the withdrawal window closes, a purchase is no longer refundable on request alone. That does not affect your rights if the product is defective: if the software does not work as advertised, article 26 of the Consumer Protection Code still protects you.',
          'In those cases, talk to us: we first try to fix the problem and, where that is not possible, we handle the refund.',
        ],
      },
      {
        heading: 'Subscriptions',
        paragraphs: [
          'For products with automatic renewal, you may cancel the renewal at any time from your account. Cancelling stops future charges and does not by itself refund the period already paid, which remains valid until it ends.',
        ],
      },
      {
        heading: 'Before opening a dispute',
        paragraphs: [
          'If something went wrong, talk to us first. A chargeback opened with your card issuer suspends the licence automatically and usually takes longer than a refund requested directly from us.',
        ],
      },
    ],
  },

  consent: {
    message:
      'We use cookies that are necessary for the site to work and, with your permission, analytics cookies to understand how the site is used. You can decline without losing any functionality.',
    acceptLabel: 'Accept analytics',
    rejectLabel: 'Decline',
    policyLinkLabel: 'Privacy Policy',
    preferencesLabel: 'Cookie preferences',
  },

  footer: {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    refund: 'Refund Policy',
  },
};
