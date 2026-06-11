interface ScorePickerProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function ScorePicker({ label, value, onChange }: ScorePickerProps) {
  return (
    <div className="score-row">
      <span>{label}</span>
      <div className="score-stars">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={score <= value ? 'score-star score-star--active' : 'score-star'}
            onClick={() => onChange(score)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
