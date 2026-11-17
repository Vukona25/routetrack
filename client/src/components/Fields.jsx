// Outlined text fields with the label sitting on the border (same as CareCollect)

export function TextField({ name, label, value, onChange, type = 'text', required, help, autoComplete, minLength, autoFocus }) {
  const id = `f-${name}`;
  return (
    <div className="mfield">
      <input
        id={id}
        name={name}
        type={type}
        placeholder=" "
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        autoFocus={autoFocus}
      />
      <label htmlFor={id}>{label}{required ? ' *' : ''}</label>
      {help && <span className="help">{help}</span>}
    </div>
  );
}

export function SelectField({ name, label, value, onChange, children, disabled }) {
  const id = `f-${name}`;
  return (
    <div className="mfield">
      <select id={id} name={name} value={value} onChange={onChange} disabled={disabled}>
        {children}
      </select>
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function TextArea({ name, label, value, onChange, help, rows = 3 }) {
  const id = `f-${name}`;
  return (
    <div className="mfield">
      <textarea id={id} name={name} placeholder=" " value={value} onChange={onChange} rows={rows} />
      <label htmlFor={id}>{label}</label>
      {help && <span className="help">{help}</span>}
    </div>
  );
}
