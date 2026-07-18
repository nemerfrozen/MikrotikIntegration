import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

test('renderiza el asistente de chat', () => {
  render(<App />);
  expect(screen.getByText(/Nueva conversación/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /\+ Nueva conversación/i })).toBeInTheDocument();
});
