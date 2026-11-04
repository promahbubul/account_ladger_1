import React from 'react';
import { KeyboardAvoidingView } from 'react-native';

// Lifts a form above the keyboard. Padding only applies to the part actually covered,
// so it does nothing on devices where the window already resizes for the keyboard.
export const KeyboardView = ({ style, children }) => (
  <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
    {children}
  </KeyboardAvoidingView>
);
