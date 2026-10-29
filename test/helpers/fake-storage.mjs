// Faux localStorage sur un objet, et stockage qui refuse tout accès (navigation privée, navigateur intégré).
export const fakeStorage = (data = {}) => ({
  data,
  getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
  setItem: (key, value) => {
    data[key] = String(value);
  },
});

export const hostile = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};
