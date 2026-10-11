/* Where the sealed notes live: the /exec URL of the Apps Script web app
   deployed from setup/family-sheet.gs. Safe to publish: everything behind it
   is ciphertext, and it only accepts saves from someone who has the passcode. */
window.FAMILY_TABLE = {
  endpoint: 'https://script.google.com/macros/s/AKfycbzHGe_XeSnekWINGJKalN3k2tU_QTCOUT9Zw9zm_CcmG6j5jUA6KHzfWom6kpdRpyN4yw/exec'
};
