import React from 'react';
import { Text } from 'react-native';
import { Skeleton } from './Skeleton';
import { formatCurrency } from '../../utils/formatters';

// Shows a skeleton while loading and the formatted value afterwards.
// A missing value renders as a dash, so a failed request never looks like a real zero.
export const Amount = ({ value, currency, isLoading = false, skeletonWidth, skeletonHeight, style, ...textProps }) => {
  if (isLoading) {
    return <Skeleton width={skeletonWidth} height={skeletonHeight} style={{ marginVertical: 4 }} />;
  }
  return (
    <Text style={style} {...textProps}>
      {formatCurrency(value, currency)}
    </Text>
  );
};
