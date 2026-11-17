import { useState } from 'react';
import { api } from '../api';

const emptyDelivery = {
  customerName: '',
  customerPhone: '',
  pickupAddress: '',
  dropoffAddress: '',
  notes: '',
  driverId: '',
};

export function NewDeliveryForm({ drivers, onCreated, onCancel }) {
  const [form, setForm] = useState(emptyDelivery);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/deliveries', {
        method: 'POST',
        body: { ...form, driverId: form.driverId ? Number(form.driverId) : null },
      });
      setForm(emptyDelivery);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={handleSubmit}>
      <h2 className="full">New delivery</h2>

      <label>
        Customer name *
        <input name="customerName" value={form.customerName} onChange={handleChange} required />
      </label>
      <label>
        Customer phone
        <input name="customerPhone" value={form.customerPhone} onChange={handleChange} />
      </label>
      <label>
        Pickup address *
        <input name="pickupAddress" value={form.pickupAddress} onChange={handleChange} required />
      </label>
      <label>
        Drop-off address *
        <input name="dropoffAddress" value={form.dropoffAddress} onChange={handleChange} required />
      </label>
      <label>
        Assign driver
        <select name="driverId" value={form.driverId} onChange={handleChange}>
          <option value="">Leave unassigned</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      <label className="full">
        Notes
        <textarea name="notes" rows="2" value={form.notes} onChange={handleChange} />
      </label>

      <div className="form-actions full">
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create delivery'}
        </button>
      </div>
    </form>
  );
}

export function AddDriverForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/drivers', { method: 'POST', body: form });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={handleSubmit}>
      <h2 className="full">Add driver</h2>

      <label>
        Full name *
        <input name="name" value={form.name} onChange={handleChange} required />
      </label>
      <label>
        Email *
        <input type="email" name="email" value={form.email} onChange={handleChange} required />
      </label>
      <label>
        Temporary password *
        <input type="password" name="password" minLength={6} value={form.password} onChange={handleChange} required />
      </label>

      <div className="form-actions full">
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Add driver'}
        </button>
      </div>
    </form>
  );
}
