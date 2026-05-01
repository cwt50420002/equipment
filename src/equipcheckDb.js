/** Supabase persistence for EquipCheck relational tables (see supabase/schema.sql). */

export async function fetchLocations(supabase) {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchEquipmentFlat(supabase) {
  const { data, error } = await supabase
    .from('equipment_items')
    .select('id, location_id, name, category, quantity, asset_id, remark, locations ( name )')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    location_id: row.location_id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    assetId: row.asset_id ?? '',
    remark: row.remark ?? '',
    area: row.locations?.name ?? '',
  }))
}

export async function fetchExtraCategories(supabase) {
  const { data, error } = await supabase.from('extra_categories').select('name')
  if (error) throw error
  return (data ?? []).map((r) => r.name)
}

export async function fetchSubmissionsUi(supabase) {
  const { data, error } = await supabase
    .from('check_submissions')
    .select(
      `
      id,
      checked_by,
      submitted_at,
      local_date_key,
      locations ( name ),
      check_submission_items (
        equipment_item_id,
        equipment_name,
        category,
        quantity,
        result,
        remark
      )
    `,
    )
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    area: row.locations?.name ?? '',
    checkedBy: row.checked_by,
    submittedAtIso: row.submitted_at,
    dateKey: row.local_date_key,
    items: (row.check_submission_items ?? []).map((ci) => ({
      equipment_item_id: ci.equipment_item_id,
      name: ci.equipment_name,
      quantity: ci.quantity ?? 1,
      category: ci.category ?? '',
      result: ci.result,
      remark: ci.remark ?? '',
    })),
  }))
}

export async function insertSubmission(supabase, payload) {
  const {
    locationId,
    checkedBy,
    submittedAtIso,
    localDateKey,
    items,
  } = payload
  const { data: sub, error: e1 } = await supabase
    .from('check_submissions')
    .insert({
      location_id: locationId,
      checked_by: checkedBy,
      submitted_at: submittedAtIso,
      local_date_key: localDateKey,
    })
    .select('id')
    .single()
  if (e1) throw e1
  const submissionId = sub.id
  const rows = items.map((it) => ({
    submission_id: submissionId,
    equipment_item_id: it.equipment_item_id || null,
    equipment_name: it.name,
    category: it.category,
    quantity: it.quantity,
    result: it.result,
    remark: it.remark ?? '',
  }))
  const { error: e2 } = await supabase.from('check_submission_items').insert(rows)
  if (e2) throw e2
  return submissionId
}

export async function insertLocation(supabase, name, sortOrder) {
  const { data, error } = await supabase
    .from('locations')
    .insert({ name, sort_order: sortOrder })
    .select('id, name, sort_order')
    .single()
  if (error) throw error
  return data
}

export async function updateLocationName(supabase, locationId, name) {
  const { error } = await supabase.from('locations').update({ name }).eq('id', locationId)
  if (error) throw error
}

export async function deleteLocationCascade(supabase, locationId) {
  const { error: e1 } = await supabase.from('check_submissions').delete().eq('location_id', locationId)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('equipment_items').delete().eq('location_id', locationId)
  if (e2) throw e2
  const { error: e3 } = await supabase.from('locations').delete().eq('id', locationId)
  if (e3) throw e3
}

export async function insertEquipmentItem(supabase, row) {
  const { error } = await supabase.from('equipment_items').insert(row)
  if (error) throw error
}

export async function updateEquipmentItem(supabase, id, patch) {
  const { error } = await supabase.from('equipment_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteEquipmentItem(supabase, id) {
  const { error } = await supabase.from('equipment_items').delete().eq('id', id)
  if (error) throw error
}

export async function renameEquipmentCategory(supabase, oldName, newName) {
  const { error } = await supabase
    .from('equipment_items')
    .update({ category: newName })
    .eq('category', oldName)
  if (error) throw error
}

export async function deleteEquipmentByCategory(supabase, categoryName) {
  const { error } = await supabase.from('equipment_items').delete().eq('category', categoryName)
  if (error) throw error
}

export async function insertExtraCategory(supabase, name) {
  const { error } = await supabase.from('extra_categories').insert({ name })
  if (error) throw error
}

export async function deleteExtraCategory(supabase, name) {
  const { error } = await supabase.from('extra_categories').delete().eq('name', name)
  if (error) throw error
}

export function locationIdByName(locations, name) {
  const n = name.trim().toLowerCase()
  const row = locations.find((l) => l.name.trim().toLowerCase() === n)
  return row?.id ?? null
}
