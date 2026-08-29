import type { Controller } from '../domain/controller';

export const notifyPairingComplete = async (controller: Controller): Promise<void> => {
  const host = controller.ip.replace(/\/+$/, '');

  try {
    const response = await fetch(`${host}/pair/complete`, {
      headers: {
        Authorization: `Bearer ${controller.token}`,
      },
      method: 'POST',
    });

    if (!response.ok) {
      console.warn('Controller pair completion returned', response.status);
    }
  } catch (error) {
    console.warn('Pairing completed locally, but controller display update failed.', error);
  }
};
