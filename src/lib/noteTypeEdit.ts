// Pure edits of a note type for the editor UI. Every function returns a type that still satisfies the schema.
import { KEY_PATTERN, LIMITS, PSEUDO_KEYS, type FieldType, type NoteFace, type NoteField, type NoteKind, type NoteType } from './deckFormat.ts';

const REQUIRED_KEYS = ['front', 'back'];
export const isFixedField = (key: string) => REQUIRED_KEYS.includes(key);

export function addNoteTypeField(type: NoteType, label = 'Trường mới', fieldType: FieldType = 'ruby'): NoteType {
  if (type.fields.length >= LIMITS.fields) return type;
  let n = type.fields.length + 1, key = `field${n}`;
  while (type.fields.some(field => field.key === key)) key = `field${++n}`;
  return { ...type, fields: [...type.fields, { key, label: label.slice(0, 60) || key, type: fieldType }], back: { ...type.back, show: [...type.back.show, key] } };
}

export function removeNoteTypeField(type: NoteType, key: string): NoteType {
  if (isFixedField(key)) return type;
  const keep = (show: string[], fallback: string) => { const next = show.filter(item => item !== key); return next.length ? next : [fallback]; };
  return {
    ...type,
    // A reading field points at its text field; removing the text field removes that link, not the reading.
    fields: type.fields.filter(field => field.key !== key).map(field => field.for === key ? (({ for: _for, ...rest }) => rest)(field) : field),
    front: { ...type.front, show: keep(type.front.show, 'front') },
    back: { ...type.back, show: keep(type.back.show, 'back') },
  };
}

export function updateNoteTypeField(type: NoteType, key: string, change: Partial<Pick<NoteField, 'label' | 'type' | 'required'>>): NoteType {
  const updated = type.fields.map(field => field.key !== key ? field : {
    ...field, ...change,
    label: (change.label ?? field.label).slice(0, 60),
    // front and back are what searching, sharing and scheduling read, so they stay required text.
    ...(isFixedField(key) ? { required: true, type: change.type === 'text' || change.type === 'ruby' ? change.type : field.type } : {}),
  });
  const stillRuby = updated.find(field => field.key === key)?.type === 'ruby';
  // A reading field can only point at a ruby field.
  return { ...type, fields: stillRuby ? updated : updated.map(field => field.for === key ? (({ for: _for, ...rest }) => rest)(field) : field) };
}

export function moveNoteTypeField(type: NoteType, key: string, delta: -1 | 1): NoteType {
  const index = type.fields.findIndex(field => field.key === key), target = index + delta;
  if (index < 0 || target < 0 || target >= type.fields.length) return type;
  const fields = [...type.fields];
  [fields[index], fields[target]] = [fields[target], fields[index]];
  return { ...type, fields };
}

export function setFaceField(type: NoteType, side: 'front' | 'back', key: string, shown: boolean): NoteType {
  const face = type[side];
  const show = shown ? (face.show.includes(key) ? face.show : [...face.show, key]) : face.show.filter(item => item !== key);
  if (!show.length) return type;
  return { ...type, [side]: { ...face, show } as NoteFace };
}

export function moveFaceField(type: NoteType, side: 'front' | 'back', key: string, delta: -1 | 1): NoteType {
  const show = [...type[side].show];
  const index = show.indexOf(key), target = index + delta;
  if (index < 0 || target < 0 || target >= show.length) return type;
  [show[index], show[target]] = [show[target], show[index]];
  return { ...type, [side]: { ...type[side], show } };
}

export function setNoteTypeKind(type: NoteType, kind: NoteKind): NoteType { return { ...type, kind }; }
export const renameNoteType = (type: NoteType, name: string): NoteType => ({ ...type, name: name.slice(0, 60) });

/** A copy under a new id, for "add a note type based on this one". */
export function cloneNoteType(type: NoteType, existingIds: string[], name = `${type.name} (bản sao)`): NoteType {
  let n = existingIds.length + 1, id = `type-${n}`;
  while (existingIds.includes(id)) id = `type-${++n}`;
  return { ...structuredClone(type), id, name: name.slice(0, 60) };
}

export const faceChoices = (type: NoteType): Array<{ key: string; label: string }> => [
  ...type.fields.map(field => ({ key: field.key, label: field.label })),
  { key: PSEUDO_KEYS[0], label: 'Loại thẻ' }, { key: PSEUDO_KEYS[1], label: 'Tên bộ thẻ' },
];

export const isValidKey = (key: string) => KEY_PATTERN.test(key);
