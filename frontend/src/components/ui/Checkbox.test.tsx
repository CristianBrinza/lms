import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox';

function Remember() {
  const [checked, setChecked] = useState(true);
  return (
    <Checkbox
      label="Keep me signed in"
      checked={checked}
      onChange={(event) => setChecked(event.target.checked)}
    />
  );
}

describe('Checkbox (option row)', () => {
  it('is a real checkbox the whole row turns on and off', async () => {
    render(<Remember />);
    const box = screen.getByRole('checkbox', { name: 'Keep me signed in' });
    expect(box).toBeChecked();
    await userEvent.click(screen.getByText('Keep me signed in'));
    expect(box).not.toBeChecked();
    await userEvent.keyboard(' ');
    expect(box).toBeChecked();
  });
});
