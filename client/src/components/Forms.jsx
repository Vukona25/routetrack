import { useState } from 'react';
import { api } from '../api';
import { hasCoords } from '../utils';
import Modal from './Modal';
import { TextField, SelectField, TextArea } from './Fields';
import { toast } from './Toast';

const emptyDelivery = {
  customerName: '',
  customerPhone: '',
  pickupAddress: '',
  dropoffAddress: '',
  notes: '',
  driverId: '',
};

export function NewDeliveryModal({ drivers, onClose, onCreated }) {
  const [form, setForm] = useState(emptyDelivery);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const created = await api('/deliveries', {
        method: 'POST',
        body: { ...form, driverId: form.driverId ? Number(form.driverId) : null },
      });
      const onMap = hasCoords(created, 'pickup') && hasCoords(created, 'dropoff');
      toast(onMap
        ? `Delivery ${created.tracking_code} created`
        : `Delivery ${created.tracking_code} created, but an address wasn't found on the map`);
      onCreated(created);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New delivery"
      subtitle="Addresses are placed on the map automatically. Include the suburb and city for the best result."
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <TextField name="customerName" label="Customer name" value={form.customerName} onChange={handleChange} required autoFocus />
        <TextField name="customerPhone" label="Customer phone" type="tel" value={form.customerPhone} onChange={handleChange} />
        <div className="span-2">
          <TextField
            name="pickupAddress"
            label="Pickup address"
            value={form.pickupAddress}
            onChange={handleChange}
            required
            help="e.g. Tembisa Mall, Tembisa"
          />
        </div>
        <div className="span-2">
          <TextField
            name="dropoffAddress"
            label="Drop-off address"
            value={form.dropoffAddress}
            onChange={handleChange}
            required
            help="e.g. 12 Andrew Mapheto Drive, Tembisa"
          />
        </div>
        <div className="span-2">
          <SelectField name="driverId" label="Driver" value={form.driverId} onChange={handleChange}>
            <option value="">Leave unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </SelectField>
        </div>
        <div className="span-2">
          <TextArea name="notes" label="Notes for the driver" value={form.notes} onChange={handleChange} rows={2} />
        </div>

        <div className="span-2 modal-actions">
          {error && <p className="auth-error grow">{error}</p>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>
            {busy ? 'Finding addresses on the map…' : 'Create delivery'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AddDriverModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const driver = await api('/drivers', { method: 'POST', body: form });
      toast(`${driver.name} can now log in`);
      onCreated(driver);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add driver" subtitle="The driver logs in with this email and temporary password." onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="span-2">
          <TextField name="name" label="Full name" value={form.name} onChange={handleChange} required autoFocus />
        </div>
        <TextField name="email" label="Email" type="email" value={form.email} onChange={handleChange} required autoComplete="off" />
        <TextField
          name="password"
          label="Temporary password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
          minLength={6}
          autoComplete="new-password"
          help="At least 6 characters"
        />

        <div className="span-2 modal-actions">
          {error && <p className="auth-error grow">{error}</p>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add driver'}</button>
        </div>
      </form>
    </Modal>
  );
}
