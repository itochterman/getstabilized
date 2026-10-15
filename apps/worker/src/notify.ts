export interface AlertMessage {
  email: string;
  listingId: number;
  title: string;
  rent: number;
  tier: string;
}

export interface Notifier {
  send(msg: AlertMessage): Promise<void>;
}

/**
 * Prints alerts instead of emailing them. Swap in a provider (Resend, Postmark, SES)
 * by implementing Notifier and choosing it in cli.ts.
 */
export const consoleNotifier: Notifier = {
  async send(m) {
    console.log(`  alert -> ${m.email}: ${m.title} ($${m.rent}/mo, ${m.tier}) /listing/${m.listingId}`);
  },
};
