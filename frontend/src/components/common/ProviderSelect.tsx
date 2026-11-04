import React, { useState } from 'react';

const BANK_PROVIDERS = [
  'AB Bank', 'Agrani Bank', 'Bank Asia', 'BRAC Bank', 'City Bank', 'Dhaka Bank', 'Dutch-Bangla Bank',
  'Eastern Bank', 'HSBC', 'Islami Bank Bangladesh', 'Janata Bank', 'Mutual Trust Bank', 'NCC Bank',
  'One Bank', 'Premier Bank', 'Prime Bank', 'Pubali Bank', 'Rupali Bank', 'Sonali Bank', 'Southeast Bank',
  'Standard Chartered', 'Trust Bank', 'United Commercial Bank', 'Uttara Bank',
];
const MOBILE_PROVIDERS = ['bKash', 'Nagad', 'Rocket', 'Upay', 'Tap'];
const OTHER = '__other';

interface ProviderSelectProps {
  accountType: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
}

// A known provider is picked from the list; "Other" opens a text field for anything else.
export const ProviderSelect: React.FC<ProviderSelectProps> = ({ accountType, value, onChange, className }) => {
  const providers = accountType === 'BANK' ? BANK_PROVIDERS : accountType === 'MOBILE_BANKING' ? MOBILE_PROVIDERS : [];
  const [chooseOther, setChooseOther] = useState(false);
  const showOther = chooseOther || (Boolean(value) && !providers.includes(value));

  return (
    <div className="space-y-2">
      <select
        value={showOther ? OTHER : value}
        onChange={(e) => {
          setChooseOther(e.target.value === OTHER);
          onChange(e.target.value === OTHER ? '' : e.target.value);
        }}
        className={className}
      >
        <option value="">None</option>
        {providers.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
        <option value={OTHER}>Other</option>
      </select>
      {showOther && (
        <input
          type="text"
          aria-label="Provider name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      )}
    </div>
  );
};
