export async function copyTextWithToast({
  text,
  successTitle,
  failureTitle = 'Copy failed',
  navigatorImpl = globalThis.navigator,
  toast = null,
}) {
  if (!navigatorImpl?.clipboard?.writeText) {
    const error = new Error('Clipboard access is unavailable.');
    toast?.({
      title: failureTitle,
      body: error.message,
      tone: 'error',
    });
    throw error;
  }

  try {
    await navigatorImpl.clipboard.writeText(text);
    toast?.({
      title: successTitle,
      tone: 'success',
    });
  } catch (error) {
    const message = error?.message || String(error);
    toast?.({
      title: failureTitle,
      body: message,
      tone: 'error',
    });
    throw error;
  }
}
