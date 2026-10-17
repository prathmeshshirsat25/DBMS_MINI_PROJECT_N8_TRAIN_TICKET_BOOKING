import React from 'react';

const STEPS = [
  { id: 1, label: 'Search & Trains' },
  { id: 2, label: 'Select Seats' },
  { id: 3, label: 'Passenger Details' },
  { id: 4, label: 'Review Summary' },
  { id: 5, label: 'Payment' },
];

export default function BookingSteps({ currentStep = 1 }) {
  return (
    <div className="booking-steps no-print">
      {STEPS.map((step, idx) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <React.Fragment key={step.id}>
            <div className={`step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
              <div className="step-num">
                {isCompleted ? '✓' : step.id}
              </div>
              <span>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`step-connector ${step.id < currentStep ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
