import React, { useState } from 'react';
import { View } from 'react-native';
import { BANK_PROVIDERS, MOBILE_PROVIDERS } from '../../constants/preferences';
import { Input } from './Input';
import { Select } from './Select';

const OTHER = '__other';

// A known provider is picked from the list; "Other" opens a text field for anything else.
export const ProviderField = ({ type, value, onChange }) => {
  const providers = type === 'BANK' ? BANK_PROVIDERS : MOBILE_PROVIDERS;
  const isKnown = providers.includes(value);
  const [chooseOther, setChooseOther] = useState(false);
  const showOther = chooseOther || (Boolean(value) && !isKnown);

  return (
    <View>
      <Select
        label={type === 'BANK' ? 'Bank' : 'Provider'}
        placeholder="Optional"
        value={showOther ? OTHER : value || ''}
        options={[...providers.map((name) => ({ value: name, label: name })), { value: OTHER, label: 'Other' }]}
        allowClear
        onChange={(picked) => {
          setChooseOther(picked === OTHER);
          onChange(picked === OTHER ? '' : picked);
        }}
      />
      {showOther ? (
        <Input
          label={type === 'BANK' ? 'Bank Name' : 'Provider Name'}
          value={value || ''}
          onChangeText={onChange}
          autoCapitalize="words"
        />
      ) : null}
    </View>
  );
};
