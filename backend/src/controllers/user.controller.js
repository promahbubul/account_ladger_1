import { SUPPORTED_CURRENCIES, SUPPORTED_DATE_FORMATS, isValidTimezone } from '../config/preferences.js';
import { dbService } from '../services/db.service.js';

export async function updateProfile(req, res) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated.' });
      return;
    }

    const { currency, fullName, timezone, dateFormat } = req.body;
    const updates = {};

    if (currency && typeof currency === 'string') {
      const upper = currency.toUpperCase().trim();
      if (!SUPPORTED_CURRENCIES.includes(upper)) {
        res.status(400).json({ error: 'Unsupported currency code.' });
        return;
      }
      updates.currency = upper;
    }

    if (typeof fullName === 'string') {
      updates.fullName = fullName.trim() || null;
    }
    if (timezone && typeof timezone === 'string') {
      if (!isValidTimezone(timezone.trim())) {
        res.status(400).json({ error: 'Unsupported timezone.' });
        return;
      }
      updates.timezone = timezone.trim();
    }
    if (dateFormat && typeof dateFormat === 'string') {
      if (!SUPPORTED_DATE_FORMATS.includes(dateFormat.trim())) {
        res.status(400).json({ error: 'Unsupported date format.' });
        return;
      }
      updates.dateFormat = dateFormat.trim();
    }

    const updated = await dbService.updateUser(req.user.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
}
