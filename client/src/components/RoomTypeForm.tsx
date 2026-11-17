import { useState, type FormEvent } from 'react';
import type { RoomTypeDTO, RoomTypeInput } from '@hotel/shared';
import { useSaveRoomType } from '../hooks/queries';
import { ApiError } from '../api/http';
import { Button } from './ui/Button';
import { Alert, errorMessage } from './ui/Feedback';
import { TextArea, TextField } from './ui/Field';

interface Draft {
  name: string;
  description: string;
  capacity: string;
  facilities: string;
  pricePerNight: string;
  totalInventory: string;
  imageUrl: string;
  isActive: boolean;
}

function toDraft(rt: RoomTypeDTO | null): Draft {
  return {
    name: rt?.name ?? '',
    description: rt?.description ?? '',
    capacity: String(rt?.capacity ?? 2),
    facilities: rt?.facilities.join(', ') ?? '',
    pricePerNight: rt ? String(rt.pricePerNight) : '',
    totalInventory: String(rt?.totalInventory ?? 1),
    imageUrl: rt?.imageUrl ?? '',
    isActive: rt?.isActive ?? true,
  };
}

/** Converts form strings to the API payload. The server validates every field again. */
function toInput(d: Draft): RoomTypeInput {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    capacity: Number(d.capacity),
    facilities: d.facilities.split(',').map((f) => f.trim()).filter(Boolean),
    pricePerNight: Number(d.pricePerNight),
    totalInventory: Number(d.totalInventory),
    isActive: d.isActive,
    imageUrl: d.imageUrl.trim() || null,
  };
}

export function RoomTypeForm({ roomType, onSaved }: { roomType: RoomTypeDTO | null; onSaved: (rt: RoomTypeDTO) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(roomType));
  const save = useSaveRoomType();
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors() : {};
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ id: roomType?.id ?? null, input: toInput(draft) }, { onSuccess: onSaved });
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {save.error && <Alert tone="error" title="Not saved">{errorMessage(save.error)}</Alert>}
      <TextField label="Name" value={draft.name} onChange={set('name')} error={fieldErrors.name} required />
      <TextArea label="Description" rows={3} value={draft.description} onChange={set('description')} error={fieldErrors.description} required />
      <div className="form-row">
        <TextField label="Sleeps" type="number" min={1} max={20} value={draft.capacity} onChange={set('capacity')} error={fieldErrors.capacity} />
        <TextField label="Price a night" type="number" min={0} step={1} value={draft.pricePerNight} onChange={set('pricePerNight')} error={fieldErrors.pricePerNight} hint="Whole amount" />
        <TextField
          label="Rooms of this type"
          type="number"
          min={0}
          value={draft.totalInventory}
          onChange={set('totalInventory')}
          error={fieldErrors.totalInventory}
          hint="Can’t go below rooms already booked"
        />
      </div>
      <TextField label="Facilities" value={draft.facilities} onChange={set('facilities')} error={fieldErrors.facilities} hint="Separate with commas" />
      <TextField label="Image URL" type="url" value={draft.imageUrl} onChange={set('imageUrl')} error={fieldErrors.imageUrl} hint="Optional. Leave empty for an illustration." />
      <label className="check">
        <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
        Open for booking
      </label>
      <div className="form-actions">
        <Button type="submit" busy={save.isPending}>
          {roomType ? 'Save changes' : 'Add room type'}
        </Button>
      </div>
    </form>
  );
}
