export function validateLoginInput(identifier, password) {
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return 'Username or email is required.';
  }
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  return null;
}

export function validateRegisterInput(email, password, fullName) {
  if (!email || !String(email).includes('@')) {
    return 'A valid email address is required.';
  }
  if (!password || String(password).length < 6) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}
