import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  deleteEquipmentByCategory,
  deleteEquipmentItem,
  deleteExtraCategory,
  deleteLocationCascade,
  fetchEquipmentFlat,
  fetchExtraCategories,
  fetchLocations,
  fetchSubmissionsUi,
  insertEquipmentItem,
  insertExtraCategory,
  insertLocation,
  insertSubmission,
  locationIdByName,
  renameEquipmentCategory,
  updateEquipmentItem,
  updateLocationName,
} from './equipcheckDb'
import { supabase, supabaseConfigured } from './supabaseClient'

const LS_KEY = 'equipcheck-v1'

function readLocalSnapshot() {
  if (typeof window === 'undefined') return { savedAt: 0 }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { savedAt: 0 }
    const o = JSON.parse(raw)
    if (typeof o.savedAt !== 'number') o.savedAt = 0
    return o
  } catch {
    return { savedAt: 0 }
  }
}

const formatDate = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)

const formatTime24 = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)

const formatDateTime = (date) => `${formatDate(date)} ${formatTime24(date)}`
const getLocalDateKey = (date) => formatDate(date)

const todayText = formatDate(new Date())

function submissionDbToUi(s) {
  return {
    id: s.id,
    area: s.area,
    checkedBy: s.checkedBy,
    submittedAt: formatDateTime(new Date(s.submittedAtIso)),
    dateKey: s.dateKey,
    items: s.items.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      category: it.category,
      result: it.result,
      remark: it.remark,
    })),
  }
}

const areaTemplates = [
  {
    name: '11/F IRA Zone A',
    equipment: [
      { name: 'Walking Stick', category: 'Mobility Aid', quantity: 1 },
      { name: 'Quadripod', category: 'Mobility Aid', quantity: 2 },
      { name: 'IFT Machine', category: 'Therapy Device', quantity: 1 },
      { name: 'Minipress Machine', category: 'Therapy Device', quantity: 1 },
    ],
  },
  {
    name: '11/F IRA Zone B',
    equipment: [
      { name: 'Walking Frame', category: 'Mobility Aid', quantity: 2 },
      { name: 'Portable Suction', category: 'Suction Unit', quantity: 1 },
      { name: 'Pulse Oximeter', category: 'Monitoring', quantity: 2 },
    ],
  },
  {
    name: '12/F Rehab Gym',
    equipment: [
      { name: 'TENS Machine', category: 'Therapy Device', quantity: 2 },
      { name: 'Treatment Couch', category: 'General', quantity: 3 },
      { name: 'Blood Pressure Device', category: 'Monitoring', quantity: 2 },
    ],
  },
]

function App() {
  const [selectedArea, setSelectedArea] = useState(() => {
    const b = readLocalSnapshot()
    const s = b.selectedArea
    return typeof s === 'string' && s.trim() ? s.trim() : areaTemplates[0].name
  })
  const [page, setPage] = useState('area')
  const [adminTab, setAdminTab] = useState('dashboard')
  const [itemResults, setItemResults] = useState({})
  const [itemRemarks, setItemRemarks] = useState({})
  const [checkedBy, setCheckedBy] = useState('')
  const [submittedAt, setSubmittedAt] = useState('')
  const [submissions, setSubmissions] = useState(() => {
    const b = readLocalSnapshot()
    return Array.isArray(b.submissions) ? b.submissions : []
  })
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [showAddEquipmentDialog, setShowAddEquipmentDialog] = useState(false)
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false)
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false)
  const [newEquipment, setNewEquipment] = useState({
    assetId: '',
    name: '',
    category: '',
    area: areaTemplates[0].name,
    remark: '',
  })
  const [equipmentDialogError, setEquipmentDialogError] = useState('')
  const [newLocationName, setNewLocationName] = useState('')
  const [locationDialogError, setLocationDialogError] = useState('')
  const [customEquipment, setCustomEquipment] = useState(() => {
    const b = readLocalSnapshot()
    return Array.isArray(b.customEquipment) ? b.customEquipment : []
  })
  const [customLocations, setCustomLocations] = useState(() => {
    const b = readLocalSnapshot()
    return Array.isArray(b.customLocations) ? b.customLocations : []
  })
  const [deletedEquipmentIds, setDeletedEquipmentIds] = useState(() => {
    const b = readLocalSnapshot()
    return Array.isArray(b.deletedEquipmentIds) ? b.deletedEquipmentIds : []
  })
  const [deletedLocations, setDeletedLocations] = useState(() => {
    const b = readLocalSnapshot()
    return Array.isArray(b.deletedLocations) ? b.deletedLocations : []
  })
  const [categoryRenames, setCategoryRenames] = useState(() => {
    const b = readLocalSnapshot()
    return b.categoryRenames && typeof b.categoryRenames === 'object' ? b.categoryRenames : {}
  })
  const [baseLocationRenames, setBaseLocationRenames] = useState(() => {
    const b = readLocalSnapshot()
    return b.baseLocationRenames && typeof b.baseLocationRenames === 'object' ? b.baseLocationRenames : {}
  })
  const [customCategories, setCustomCategories] = useState(() => {
    const b = readLocalSnapshot()
    return Array.isArray(b.customCategories) ? b.customCategories : []
  })
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryDialogError, setCategoryDialogError] = useState('')
  const [deletedCategories, setDeletedCategories] = useState(() => {
    const b = readLocalSnapshot()
    return Array.isArray(b.deletedCategories) ? b.deletedCategories : []
  })
  const [equipmentEdits, setEquipmentEdits] = useState(() => {
    const b = readLocalSnapshot()
    return b.equipmentEdits && typeof b.equipmentEdits === 'object' ? b.equipmentEdits : {}
  })
  const [showEditEquipmentDialog, setShowEditEquipmentDialog] = useState(false)
  const [editingEquipmentId, setEditingEquipmentId] = useState('')
  const [editEquipment, setEditEquipment] = useState({
    assetId: '',
    name: '',
    category: '',
    area: '',
    remark: '',
  })
  const [editEquipmentError, setEditEquipmentError] = useState('')
  const [showEditLocationDialog, setShowEditLocationDialog] = useState(false)
  const [editingLocationName, setEditingLocationName] = useState('')
  const [editLocationName, setEditLocationName] = useState('')
  const [editLocationError, setEditLocationError] = useState('')
  const [showEditCategoryDialog, setShowEditCategoryDialog] = useState(false)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryError, setEditCategoryError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const dbMode = supabaseConfigured

  const [dbLocations, setDbLocations] = useState([])
  const [dbEquipment, setDbEquipment] = useState([])
  const [dbExtraCategories, setDbExtraCategories] = useState([])

  const [syncReady, setSyncReady] = useState(() => !supabaseConfigured)
  const [syncError, setSyncError] = useState(null)
  const skipSaveRef = useRef(true)

  const reloadFromDatabase = useCallback(async () => {
    if (!supabase) return { locations: [], equipment: [], submissions: [] }
    const [locs, eq, cats, subs] = await Promise.all([
      fetchLocations(supabase),
      fetchEquipmentFlat(supabase),
      fetchExtraCategories(supabase),
      fetchSubmissionsUi(supabase),
    ])
    setDbLocations(locs)
    setDbEquipment(eq)
    setDbExtraCategories(cats)
    setSubmissions(subs.map(submissionDbToUi))
    if (locs.length > 0) {
      setSelectedArea((prev) =>
        locs.some((l) => l.name === prev) ? prev : locs[0].name,
      )
    }
    return { locations: locs, equipment: eq, submissions: subs }
  }, [])

  const persistedPayload = useMemo(
    () => ({
      submissions,
      customEquipment,
      customLocations,
      deletedEquipmentIds,
      deletedLocations,
      categoryRenames,
      baseLocationRenames,
      customCategories,
      deletedCategories,
      equipmentEdits,
      selectedArea,
    }),
    [
      submissions,
      customEquipment,
      customLocations,
      deletedEquipmentIds,
      deletedLocations,
      categoryRenames,
      baseLocationRenames,
      customCategories,
      deletedCategories,
      equipmentEdits,
      selectedArea,
    ],
  )

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return
    let cancelled = false
    ;(async () => {
      try {
        await reloadFromDatabase()
      } catch (e) {
        if (!cancelled) setSyncError(e.message ?? String(e))
      } finally {
        if (!cancelled) setSyncReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadFromDatabase])

  useEffect(() => {
    if (!syncReady || !supabaseConfigured) return
    skipSaveRef.current = false
  }, [syncReady])

  useEffect(() => {
    if (dbMode || typeof window === 'undefined') return
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ ...persistedPayload, savedAt: Date.now() }),
      )
    } catch {
      /* quota / private mode */
    }
  }, [dbMode, persistedPayload])

  useEffect(() => {
    if (!supabaseConfigured || !supabase || !syncReady || skipSaveRef.current || dbMode) return
    const payloadForRemote = { ...persistedPayload, savedAt: Date.now() }
    const handle = setTimeout(async () => {
      const { error } = await supabase.from('app_state').upsert(
        {
          id: 'main',
          payload: payloadForRemote,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      if (error) setSyncError(error.message)
      else setSyncError(null)
    }, 400)
    return () => clearTimeout(handle)
  }, [dbMode, syncReady, persistedPayload])

  const handleAreaChange = (areaName) => {
    setSelectedArea(areaName)
  }

  const buildAreaEquipment = (areaName) => {
    if (dbMode) {
      const normalizedArea = areaName.trim().toLowerCase()
      return dbEquipment
        .filter((item) => item.area.trim().toLowerCase() === normalizedArea)
        .map((item, index) => ({
          id: index + 1,
          ...item,
          assetId: item.assetId || '',
          status: 'Due',
        }))
    }
    const normalizedArea = areaName.trim().toLowerCase()
    const baseTemplate = areaTemplates.find(
      (area) =>
        area.name.trim().toLowerCase() === normalizedArea ||
        (baseLocationRenames[area.name] || '').trim().toLowerCase() === normalizedArea,
    )
    const baseItems = baseTemplate
      ? baseTemplate.equipment
          .map((item, index) => {
            const sourceId = `${baseTemplate.name}-${item.name}-${index}`
            const edited = equipmentEdits[sourceId] || {}
            return {
              id: sourceId,
              name: item.name,
              category: item.category,
              quantity: item.quantity,
              area: areaName,
              assetId: '',
              ...edited,
            }
          })
          .filter(
            (item) =>
              item.area.trim().toLowerCase() === normalizedArea &&
              !deletedEquipmentIds.includes(item.id),
          )
      : []
    const customItems = customEquipment
      .filter((item) => item.area.trim().toLowerCase() === normalizedArea)
      .map((item) => {
        const edited = equipmentEdits[item.id] || {}
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          area: item.area,
          assetId: item.assetId || '',
          ...edited,
        }
      })
      .filter(
        (item) =>
          item.area.trim().toLowerCase() === normalizedArea &&
          !deletedEquipmentIds.includes(item.id),
      )

    return [...baseItems, ...customItems]
      .filter((item) => !deletedLocations.includes(item.area))
      .map((item, index) => ({
      id: index + 1,
      ...item,
      status: 'Due',
    }))
  }

  const equipmentInArea = buildAreaEquipment(selectedArea)
  const groupedEquipment = equipmentInArea.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {})
  const allItemsAnswered = equipmentInArea.every(
    (item) => Boolean(itemResults[`${selectedArea}-${item.id}`]),
  )
  const leanedItemsMissingRemark = equipmentInArea.filter((item) => {
    const key = `${selectedArea}-${item.id}`
    return itemResults[key] === 'Leaned' && !itemRemarks[key]?.trim()
  })
  const ngItemsMissingRemark = equipmentInArea.filter((item) => {
    const key = `${selectedArea}-${item.id}`
    return itemResults[key] === 'NG' && !itemRemarks[key]?.trim()
  })
  const leanedRemarkWarning =
    leanedItemsMissingRemark.length > 0
      ? 'Please type remark with location for each item marked Leaned.'
      : ''
  const ngRemarkWarning =
    ngItemsMissingRemark.length > 0
      ? 'Please type reason for each item marked NG.'
      : ''
  const todayKey = getLocalDateKey(new Date())
  const todaySubmissions = submissions.filter((submission) => submission.dateKey === todayKey)
  const submittedAreasToday = new Set(todaySubmissions.map((submission) => submission.area))
  const allLocations = dbMode
    ? dbLocations.map((l) => l.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    : [...areaTemplates.map((area) => baseLocationRenames[area.name] || area.name), ...customLocations]
        .filter((name) => !deletedLocations.includes(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const pendingAreasToday = allLocations.filter((areaName) => !submittedAreasToday.has(areaName))
  const latestItemStatusMap = todaySubmissions.reduce((acc, submission) => {
    submission.items.forEach((item, index) => {
      const issueKey = `${submission.area}::${item.name}::${index}`
      if (!acc[issueKey]) {
        acc[issueKey] = {
          key: `${submission.id}-${item.name}-${index}`,
          item,
          submission,
          submissionCount: 1,
        }
      } else {
        acc[issueKey].submissionCount += 1
      }
    })
    return acc
  }, {})
  const totalsByResult = Object.values(latestItemStatusMap).reduce(
    (acc, { item }) => {
      if (item.result === 'Good') acc.Good += 1
      if (item.result === 'NG') acc.NG += 1
      if (item.result === 'Leaned') acc.Leaned += 1
      if (item.result === 'Others') acc.Others += 1
      return acc
    },
    { Good: 0, NG: 0, Leaned: 0, Others: 0 },
  )
  const recentIssues = Object.values(latestItemStatusMap).filter(
    ({ item }) => item.result !== 'Good',
  )
  const latestSubmissionForArea = todaySubmissions.find(
    (submission) => submission.area === selectedArea,
  )
  const allEquipmentCatalog = dbMode
    ? dbEquipment.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        area: item.area,
        assetId: item.assetId || '',
        remark: item.remark || '',
      }))
    : [
        ...areaTemplates.flatMap((area) =>
          area.equipment.map((item, index) => ({
            id: `${area.name}-${item.name}-${index}`,
            name: item.name,
            category: categoryRenames[item.category] || item.category,
            quantity: item.quantity,
            area: baseLocationRenames[area.name] || area.name,
          })),
        ),
        ...customEquipment,
      ]
          .map((item) => ({
            ...item,
            ...(equipmentEdits[item.id] || {}),
          }))
          .filter((item) => !deletedEquipmentIds.includes(item.id))
          .filter((item) => !deletedLocations.includes(item.area))
  const filteredEquipmentCatalog = allEquipmentCatalog.filter((item) =>
    `${item.name} ${item.category} ${item.area}`
      .toLowerCase()
      .includes(equipmentSearch.trim().toLowerCase()),
  )
  const categoryOptions = dbMode
    ? Array.from(new Set([...dbEquipment.map((item) => item.category), ...dbExtraCategories]))
        .filter((category) => !deletedCategories.includes(category))
        .sort((a, b) => a.localeCompare(b))
    : Array.from(new Set([...allEquipmentCatalog.map((item) => item.category), ...customCategories]))
        .filter((category) => !deletedCategories.includes(category))
        .sort((a, b) => a.localeCompare(b))
  const locationRows = allLocations
  const [reportMonth, setReportMonth] = useState('2026-05')
  const [reportZone, setReportZone] = useState('all')
  const [reportStatus, setReportStatus] = useState('all')
  const reportRows = useMemo(() => {
    const rows = submissions.flatMap((submission) => {
      const [datePart = '', timePart = ''] = submission.submittedAt.split(' ')
      const monthFromDate =
        datePart && datePart.includes('/')
          ? `${datePart.split('/')[2]}-${datePart.split('/')[1]}`
          : ''
      return submission.items.map((item, index) => ({
        id: `${submission.id}-${index}`,
        monthKey: monthFromDate,
        date: datePart,
        time: timePart,
        assistant: submission.checkedBy,
        zone: submission.area,
        zoneShort: submission.area.split(' ').at(-1) ?? '-',
        equipment: item.name,
        status: item.result,
        checkedBy: submission.checkedBy,
        remark: item.remark?.trim() || '-',
      }))
    })

    return rows.filter((row) => {
      if (reportMonth !== 'all' && row.monthKey !== reportMonth) return false
      if (reportZone !== 'all' && row.zone !== reportZone) return false
      if (reportStatus !== 'all' && row.status !== reportStatus) return false
      return true
    })
  }, [reportMonth, reportStatus, reportZone, submissions])

  const handleExportCsv = () => {
    const headers = ['Date', 'Time', 'Location', 'Equipment', 'Status', 'Checked By', 'Remark']
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

    const rows = reportRows.map((row) => [
      row.date,
      row.time,
      row.zone,
      row.equipment,
      row.status,
      row.checkedBy,
      row.remark,
    ])

    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = formatDate(new Date()).replaceAll('/', '-')
    link.href = url
    link.download = `reports-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  const equipmentRows = filteredEquipmentCatalog.map((item, index) => {
    const areaToken = item.area.split(' ').at(-1) ?? 'A'
    const prefix = areaToken.charAt(0).toUpperCase()
    const fallbackAssetId = `${prefix}-${String(index + 1).padStart(3, '0')}`
    return { ...item, assetId: item.assetId || fallbackAssetId, remark: item.remark || '-' }
  })

  const handleItemResultChange = (equipmentId, value) => {
    const key = `${selectedArea}-${equipmentId}`
    setItemResults((prev) => {
      const previousValue = prev[key]
      if (previousValue === value) {
        return prev
      }
      setItemRemarks((prevRemarks) => ({
        ...prevRemarks,
        [key]: '',
      }))
      return {
        ...prev,
        [key]: value,
      }
    })
  }

  const handleItemRemarkChange = (equipmentId, value) => {
    setItemRemarks((prev) => ({
      ...prev,
      [`${selectedArea}-${equipmentId}`]: value,
    }))
  }

  const getAreaItemCount = (areaName) => buildAreaEquipment(areaName).length

  const handleCreateEquipment = () => {
    const assetId = newEquipment.assetId.trim()
    const name = newEquipment.name.trim()
    const category = newEquipment.category.trim()
    const areaInput = newEquipment.area.trim()
    const area =
      allLocations.find(
        (locationName) =>
          locationName.trim().toLowerCase() === areaInput.trim().toLowerCase(),
      ) || areaInput

    if (!assetId) {
      setEquipmentDialogError('Asset ID is required. If no Asset ID, please type 0.')
      return
    }

    if (!name || !category || !areaInput) {
      setEquipmentDialogError('Please complete all required fields (Remark is optional).')
      return
    }

    if (dbMode && supabase) {
      void (async () => {
        const locId = locationIdByName(dbLocations, area)
        if (!locId) {
          setEquipmentDialogError('Unknown location.')
          return
        }
        try {
          await insertEquipmentItem(supabase, {
            id: crypto.randomUUID(),
            location_id: locId,
            name,
            category,
            quantity: 1,
            asset_id: assetId,
            remark: newEquipment.remark.trim(),
          })
          await reloadFromDatabase()
          setNewEquipment({
            assetId: '',
            name: '',
            category: '',
            area: dbLocations[0]?.name ?? areaTemplates[0].name,
            remark: '',
          })
          setEquipmentDialogError('')
          setShowAddEquipmentDialog(false)
          setSyncError(null)
        } catch (e) {
          setEquipmentDialogError(e.message ?? String(e))
        }
      })()
      return
    }

    const createdItem = {
      id: crypto.randomUUID(),
      assetId,
      name,
      category,
      area,
      quantity: 1,
      remark: newEquipment.remark.trim(),
    }

    setCustomEquipment((prev) => [createdItem, ...prev])
    setNewEquipment({
      assetId: '',
      name: '',
      category: '',
      area: areaTemplates[0].name,
      remark: '',
    })
    setEquipmentDialogError('')
    setShowAddEquipmentDialog(false)
  }

  const handleCreateCategory = () => {
    const name = newCategoryName.trim()
    if (!name) {
      setCategoryDialogError('Please enter category name.')
      return
    }
    const exists = categoryOptions.some(
      (category) => category.toLowerCase() === name.toLowerCase(),
    )
    if (exists) {
      setCategoryDialogError('This category already exists.')
      return
    }
    if (dbMode && supabase) {
      void (async () => {
        try {
          await insertExtraCategory(supabase, name)
          await reloadFromDatabase()
          setShowAddCategoryDialog(false)
          setNewCategoryName('')
          setCategoryDialogError('')
          setSyncError(null)
        } catch (e) {
          setCategoryDialogError(e.message ?? String(e))
        }
      })()
      return
    }
    setCustomCategories((prev) => [...prev, name])
    setShowAddCategoryDialog(false)
    setNewCategoryName('')
    setCategoryDialogError('')
  }

  const handleStartEditLocation = (locationName) => {
    setEditingLocationName(locationName)
    setEditLocationName(locationName)
    setEditLocationError('')
    setShowEditLocationDialog(true)
  }

  const handleSaveEditLocation = () => {
    const oldName = editingLocationName
    const newName = editLocationName.trim()
    if (!oldName) return
    if (!newName) {
      setEditLocationError('Please enter location name.')
      return
    }
    const duplicate = allLocations.some(
      (name) => name.toLowerCase() === newName.toLowerCase() && name !== oldName,
    )
    if (duplicate) {
      setEditLocationError('This location already exists.')
      return
    }

    if (dbMode && supabase) {
      void (async () => {
        const locId = locationIdByName(dbLocations, oldName)
        if (!locId) {
          setEditLocationError('Location not found.')
          return
        }
        try {
          await updateLocationName(supabase, locId, newName)
          await reloadFromDatabase()
          if (selectedArea === oldName) setSelectedArea(newName)
          if (reportZone === oldName) setReportZone(newName)
          setShowEditLocationDialog(false)
          setEditingLocationName('')
          setEditLocationName('')
          setEditLocationError('')
          setSyncError(null)
        } catch (e) {
          setEditLocationError(e.message ?? String(e))
        }
      })()
      return
    }

    const baseMatch = areaTemplates.find(
      (area) => (baseLocationRenames[area.name] || area.name) === oldName,
    )
    if (baseMatch) {
      setBaseLocationRenames((prev) => ({ ...prev, [baseMatch.name]: newName }))
    } else {
      setCustomLocations((prev) => prev.map((name) => (name === oldName ? newName : name)))
    }

    setCustomEquipment((prev) =>
      prev.map((item) => (item.area === oldName ? { ...item, area: newName } : item)),
    )
    setSubmissions((prev) =>
      prev.map((submission) =>
        submission.area === oldName ? { ...submission, area: newName } : submission,
      ),
    )

    if (selectedArea === oldName) setSelectedArea(newName)
    if (reportZone === oldName) setReportZone(newName)

    setShowEditLocationDialog(false)
    setEditingLocationName('')
    setEditLocationName('')
    setEditLocationError('')
  }

  const executeDeleteEquipment = (item) => {
    if (dbMode && supabase) {
      void (async () => {
        try {
          await deleteEquipmentItem(supabase, item.id)
          await reloadFromDatabase()
          setSyncError(null)
        } catch (e) {
          setSyncError(e.message ?? String(e))
        }
      })()
      return
    }
    setDeletedEquipmentIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
    setEquipmentEdits((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
  }

  const executeDeleteLocation = (locationName) => {
    if (dbMode && supabase) {
      void (async () => {
        const locId = locationIdByName(dbLocations, locationName)
        if (!locId) return
        try {
          await deleteLocationCascade(supabase, locId)
          const { locations: locsAfter } = await reloadFromDatabase()
          if (selectedArea === locationName) {
            const fallback = locsAfter[0]?.name
            if (fallback) setSelectedArea(fallback)
            else setPage('area')
          }
          if (reportZone === locationName) setReportZone('all')
          setSyncError(null)
        } catch (e) {
          setSyncError(e.message ?? String(e))
        }
      })()
      return
    }
    setDeletedLocations((prev) =>
      prev.includes(locationName) ? prev : [...prev, locationName],
    )
    setCustomLocations((prev) => prev.filter((name) => name !== locationName))
    setCustomEquipment((prev) => prev.filter((item) => item.area !== locationName))
    if (selectedArea === locationName) {
      const fallback = allLocations.find((name) => name !== locationName)
      if (fallback) {
        setSelectedArea(fallback)
      } else {
        setPage('area')
      }
    }
    if (reportZone === locationName) {
      setReportZone('all')
    }
  }

  const handleStartEditCategory = (categoryName) => {
    setEditingCategoryName(categoryName)
    setEditCategoryName(categoryName)
    setEditCategoryError('')
    setShowEditCategoryDialog(true)
  }

  const handleSaveEditCategory = () => {
    const oldName = editingCategoryName
    const newName = editCategoryName.trim()
    if (!newName) {
      setEditCategoryError('Please enter category name.')
      return
    }
    const duplicate = categoryOptions.some(
      (category) => category.toLowerCase() === newName.toLowerCase() && category !== oldName,
    )
    if (duplicate) {
      setEditCategoryError('This category already exists.')
      return
    }
    if (dbMode && supabase) {
      void (async () => {
        try {
          await renameEquipmentCategory(supabase, oldName, newName)
          await deleteExtraCategory(supabase, oldName).catch(() => {})
          await insertExtraCategory(supabase, newName).catch(() => {})
          await reloadFromDatabase()
          setShowEditCategoryDialog(false)
          setEditingCategoryName('')
          setEditCategoryName('')
          setEditCategoryError('')
          setSyncError(null)
        } catch (e) {
          setEditCategoryError(e.message ?? String(e))
        }
      })()
      return
    }
    setCustomCategories((prev) => prev.map((name) => (name === oldName ? newName : name)))
    setCategoryRenames((prev) => ({ ...prev, [oldName]: newName }))
    setCustomEquipment((prev) =>
      prev.map((item) => (item.category === oldName ? { ...item, category: newName } : item)),
    )
    setEquipmentEdits((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((id) => {
        if (next[id]?.category === oldName) {
          next[id] = { ...next[id], category: newName }
        }
      })
      return next
    })
    setShowEditCategoryDialog(false)
    setEditingCategoryName('')
    setEditCategoryName('')
    setEditCategoryError('')
  }

  const executeDeleteCategory = (categoryName) => {
    if (dbMode && supabase) {
      void (async () => {
        try {
          await deleteEquipmentByCategory(supabase, categoryName)
          await deleteExtraCategory(supabase, categoryName).catch(() => {})
          await reloadFromDatabase()
          setSyncError(null)
        } catch (e) {
          setSyncError(e.message ?? String(e))
        }
      })()
      return
    }
    setDeletedCategories((prev) =>
      prev.includes(categoryName) ? prev : [...prev, categoryName],
    )
    setCustomCategories((prev) => prev.filter((name) => name !== categoryName))
    setCustomEquipment((prev) => prev.filter((item) => item.category !== categoryName))
    setEquipmentEdits((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((id) => {
        if (next[id]?.category === categoryName) {
          delete next[id]
        }
      })
      return next
    })
  }

  const requestDelete = (kind, payload) => {
    setDeleteConfirm({ kind, payload })
  }

  const confirmDelete = () => {
    if (!deleteConfirm) return
    if (deleteConfirm.kind === 'equipment') {
      executeDeleteEquipment(deleteConfirm.payload)
    }
    if (deleteConfirm.kind === 'location') {
      executeDeleteLocation(deleteConfirm.payload)
    }
    if (deleteConfirm.kind === 'category') {
      executeDeleteCategory(deleteConfirm.payload)
    }
    setDeleteConfirm(null)
  }

  const handleStartEditEquipment = (item) => {
    setEditingEquipmentId(item.id)
    setEditEquipment({
      assetId: item.assetId || '',
      name: item.name || '',
      category: item.category || '',
      area: item.area || allLocations[0] || '',
      remark: item.remark || '',
    })
    setEditEquipmentError('')
    setShowEditEquipmentDialog(true)
  }

  const handleSaveEditEquipment = () => {
    if (!editingEquipmentId) return
    const assetId = editEquipment.assetId.trim()
    const name = editEquipment.name.trim()
    const category = editEquipment.category.trim()
    const area = editEquipment.area.trim()
    if (!assetId || !name || !category || !area) {
      setEditEquipmentError('Please complete all required fields.')
      return
    }
    if (dbMode && supabase) {
      void (async () => {
        const locId = locationIdByName(dbLocations, area)
        if (!locId) {
          setEditEquipmentError('Unknown location.')
          return
        }
        try {
          await updateEquipmentItem(supabase, editingEquipmentId, {
            asset_id: assetId,
            name,
            category,
            remark: editEquipment.remark.trim(),
            location_id: locId,
          })
          await reloadFromDatabase()
          setShowEditEquipmentDialog(false)
          setEditingEquipmentId('')
          setEditEquipmentError('')
          setSyncError(null)
        } catch (e) {
          setEditEquipmentError(e.message ?? String(e))
        }
      })()
      return
    }
    setEquipmentEdits((prev) => ({
      ...prev,
      [editingEquipmentId]: {
        assetId,
        name,
        category,
        area,
        remark: editEquipment.remark.trim(),
      },
    }))
    setShowEditEquipmentDialog(false)
    setEditingEquipmentId('')
    setEditEquipmentError('')
  }

  return (
    <div className="page">
      <header className="topbar">
        {page === 'area' ? (
          <p className="brand">
            <span className="nav-icon">◍</span> EquipCheck
          </p>
        ) : (
          <button type="button" className="topbar-back-btn" onClick={() => setPage('area')}>
            <span className="nav-icon">←</span>
          </button>
        )}
        <div className="topbar-actions">
          {page === 'admin' ? (
            <div className="admin-nav-tabs">
              <button
                type="button"
                className={`tab ${adminTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setAdminTab('dashboard')}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={`tab ${adminTab === 'equipment' ? 'active' : ''}`}
                onClick={() => setAdminTab('equipment')}
              >
                Equipment
              </button>
              <button
                type="button"
                className={`tab ${adminTab === 'category' ? 'active' : ''}`}
                onClick={() => setAdminTab('category')}
              >
                Category
              </button>
              <button
                type="button"
                className={`tab ${adminTab === 'location' ? 'active' : ''}`}
                onClick={() => setAdminTab('location')}
              >
                Location
              </button>
              <button
                type="button"
                className={`tab ${adminTab === 'reports' ? 'active' : ''}`}
                onClick={() => setAdminTab('reports')}
              >
                Reports
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="topbar-index-btn"
              onClick={() => {
                setAdminTab('dashboard')
                setPage('admin')
              }}
            >
              <span className="nav-icon">⚙</span> Admin
            </button>
          )}
        </div>
      </header>

      {supabaseConfigured && (!syncReady || syncError) ? (
        <div className={`sync-banner ${syncError ? 'sync-banner-error' : ''}`} role="status">
          {!syncReady ? 'Loading saved data…' : `Could not sync: ${syncError}`}
        </div>
      ) : null}

      <main className="content">
        <section className="hero">
          <h1>Daily Equipment Check</h1>
          <p>{todayText}</p>
        </section>

        {page === 'area' ? (
          <section className="card index-card">
            <div className="area-grid">
              {allLocations.map((locationName) => (
                <button
                  key={locationName}
                  type="button"
                  className={`area-card ${locationName === selectedArea ? 'selected' : ''}`}
                  onClick={() => {
                    handleAreaChange(locationName)
                    setPage('equipment')
                  }}
                >
                  <div className="area-card-top">
                    <div className="area-title-wrap">
                      <span className="area-icon">◎</span>
                      <span className="area-title">{locationName}</span>
                    </div>
                    <span
                      className={`status-badge ${
                        submittedAreasToday.has(locationName) ? 'completed' : 'pending'
                      }`}
                    >
                      {submittedAreasToday.has(locationName) ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <div className="area-card-bottom">
                    <span>{getAreaItemCount(locationName)} items</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : page === 'equipment' ? (
          <section className="card">
            <h2>Daily Equipment Check</h2>
            <p className="equipment-area">{selectedArea}</p>

            {latestSubmissionForArea ? (
              <div className="submission-note">
                Already submitted today. Submitted at {latestSubmissionForArea.submittedAt}. You
                can update and submit again.
              </div>
            ) : null}

            <div className="equipment-groups">
              {Object.entries(groupedEquipment).map(([category, items]) => (
                <section key={category} className="equipment-group">
                  <h3>{category}</h3>
                  <ul className="equipment-items">
                    {items.map((item) => (
                      <li key={item.id} className="equipment-row-card">
                        <div className="item-head">
                          <span className="item-name">{item.name}</span>
                          <small>
                            A-{String(item.id).padStart(3, '0')} | {selectedArea}
                          </small>
                        </div>
                        <div className="item-options">
                          {[
                            ['Good', 'Good', '◌'],
                            ['NG', 'NG', '⊗'],
                            ['Leaned', 'Leaned', '◔'],
                            ['Others', 'Others', '⋯'],
                          ].map(([value, label, icon]) => (
                            <label
                              key={`${item.id}-${value}`}
                              className={
                                itemResults[`${selectedArea}-${item.id}`] === value
                                  ? 'option-pill active'
                                  : 'option-pill'
                              }
                            >
                              <input
                                type="radio"
                                name={`result-${selectedArea}-${item.id}`}
                                value={value}
                                checked={itemResults[`${selectedArea}-${item.id}`] === value}
                                onChange={(event) =>
                                  handleItemResultChange(item.id, event.target.value)
                                }
                              />
                              <span className="option-icon">{icon}</span>
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={itemRemarks[`${selectedArea}-${item.id}`] ?? ''}
                          onChange={(event) => handleItemRemarkChange(item.id, event.target.value)}
                          placeholder="Optional remarks..."
                        />
                        {itemResults[`${selectedArea}-${item.id}`] === 'Leaned' &&
                        !itemRemarks[`${selectedArea}-${item.id}`]?.trim() ? (
                          <p className="item-warning">
                            Please enter remark with the location of this leaned item.
                          </p>
                        ) : null}
                        {itemResults[`${selectedArea}-${item.id}`] === 'NG' &&
                        !itemRemarks[`${selectedArea}-${item.id}`]?.trim() ? (
                          <p className="item-warning">
                            Please enter the reason for this NG item.
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="submit-section sticky-submit">
              {leanedRemarkWarning ? <p className="submit-warning">{leanedRemarkWarning}</p> : null}
              {ngRemarkWarning ? <p className="submit-warning">{ngRemarkWarning}</p> : null}
              <label className="remark-field">
                Checked by
                <input
                  type="text"
                  value={checkedBy}
                  onChange={(event) => setCheckedBy(event.target.value)}
                  placeholder="Type staff name"
                />
              </label>
              <button
                type="button"
                className="primary"
                disabled={
                  !allItemsAnswered ||
                  !checkedBy.trim() ||
                  Boolean(leanedRemarkWarning) ||
                  Boolean(ngRemarkWarning)
                }
                onClick={() => {
                  void (async () => {
                    const now = new Date()
                    const submittedTime = formatDateTime(now)
                    const itemSnapshot = equipmentInArea.map((item) => ({
                      equipment_item_id: item.id,
                      name: item.name,
                      quantity: item.quantity,
                      category: item.category,
                      result: itemResults[`${selectedArea}-${item.id}`],
                      remark: itemRemarks[`${selectedArea}-${item.id}`] ?? '',
                    }))

                    if (dbMode && supabase) {
                      const locId = locationIdByName(dbLocations, selectedArea)
                      if (!locId) {
                        setSyncError('Unknown location.')
                        return
                      }
                      try {
                        await insertSubmission(supabase, {
                          locationId: locId,
                          checkedBy: checkedBy.trim(),
                          submittedAtIso: now.toISOString(),
                          localDateKey: getLocalDateKey(now),
                          items: itemSnapshot,
                        })
                        await reloadFromDatabase()
                        setSubmittedAt(submittedTime)
                        setPage('submitted')
                        setSyncError(null)
                      } catch (e) {
                        setSyncError(e.message ?? String(e))
                      }
                      return
                    }

                    const newSubmission = {
                      id: crypto.randomUUID(),
                      area: selectedArea,
                      checkedBy: checkedBy.trim(),
                      submittedAt: submittedTime,
                      dateKey: getLocalDateKey(now),
                      items: itemSnapshot.map((row) => ({
                        name: row.name,
                        quantity: row.quantity,
                        category: row.category,
                        result: row.result,
                        remark: row.remark,
                      })),
                    }

                    setSubmissions((prev) => [newSubmission, ...prev])
                    setSubmittedAt(submittedTime)
                    setPage('submitted')
                  })()
                }}
              >
                {latestSubmissionForArea ? 'Update Checklist' : 'Submit'}
              </button>
            </div>
          </section>
        ) : page === 'submitted' ? (
          <section className="card">
            <h2>Submission Complete</h2>
            <p className="submit-message">
              Survey submitted for {selectedArea} by {checkedBy.trim()}, {submittedAt}
            </p>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setPage('area')}>
                Return to Index Page
              </button>
            </div>
          </section>
        ) : adminTab === 'dashboard' ? (
          <section className="card admin-page">
            <h2>Admin Dashboard</h2>
            <p className="equipment-area">Overview for {new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' })}</p>

            <section className="equipment-group">
              <ul className="admin-totals admin-kpi-grid">
                <li>
                  <span>Total Good</span>
                  <strong>{totalsByResult.Good}</strong>
                </li>
                <li>
                  <span>Total NG</span>
                  <strong>{totalsByResult.NG}</strong>
                </li>
                <li>
                  <span>Total Leaned</span>
                  <strong>{totalsByResult.Leaned}</strong>
                </li>
                <li>
                  <span>Total Others</span>
                  <strong>{totalsByResult.Others}</strong>
                </li>
              </ul>
            </section>

            <div className="admin-panels">
              <section className="admin-panel">
                <h3>Recent Issues</h3>
                {todaySubmissions.length === 0 ? (
                  <p className="empty">No submissions today.</p>
                ) : (
                  <ul className="issues-list">
                    {recentIssues
                      .slice(0, 8)
                      .map(({ key, item, submission, submissionCount }) => (
                        <li key={key}>
                          <p>
                            <span className={`issue-pill ${item.result.toLowerCase()}`}>
                              {item.result}
                            </span>{' '}
                            <strong>{item.name}</strong>{' '}
                            {submissionCount > 1 ? (
                              <span className="edited-tag">Edited</span>
                            ) : null}
                          </p>
                          <small>
                            Checked by {submission.checkedBy}, {submission.area} on{' '}
                            {submission.submittedAt}
                          </small>
                          <small>Remark: {item.remark?.trim() ? item.remark : '-'}</small>
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              <section className="admin-panel side">
                <h3>Today's Status</h3>
                <p className="panel-subtitle">{todayText}</p>
                <ul className="status-list">
                  {allLocations.map((locationName) => {
                    const done = submittedAreasToday.has(locationName)
                    return (
                      <li key={locationName}>
                        <div>
                          <strong>{locationName}</strong>
                          <small>{locationName.split(' ').slice(0, 2).join(' ')}</small>
                        </div>
                        <span className={done ? 'done' : 'pending'}>
                          {done ? 'Done' : 'Pending'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {pendingAreasToday.length > 0 ? (
                  <p className="pending-note">{pendingAreasToday.length} area(s) pending today.</p>
                ) : null}
              </section>
            </div>
          </section>
        ) : adminTab === 'equipment' ? (
          <section className="card admin-page">
            <div className="equipment-page-head">
              <div>
                <h2>Equipment Master List</h2>
                <p className="equipment-area">Manage the equipment catalogue used for daily checks.</p>
              </div>
              <button
                type="button"
                className="add-equipment-btn"
                onClick={() => setShowAddEquipmentDialog(true)}
              >
                + Add Equipment
              </button>
            </div>

            <div className="equipment-toolbar">
              <input
                type="text"
                value={equipmentSearch}
                onChange={(event) => setEquipmentSearch(event.target.value)}
                placeholder="Search by name, asset ID, category or location..."
              />
            </div>

            <div className="equipment-table-wrap">
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Remark</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentRows.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-row">
                        No equipment found.
                      </td>
                    </tr>
                  ) : (
                    equipmentRows.map((item) => (
                      <tr key={item.id}>
                        <td>{item.assetId}</td>
                        <td>{item.name}</td>
                        <td>
                          <span className="category-tag">{item.category}</span>
                        </td>
                        <td>{item.area}</td>
                        <td>{item.remark}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              aria-label="Edit"
                              onClick={() => handleStartEditEquipment(item)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              aria-label="Delete"
                              onClick={() => requestDelete('equipment', item)}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {showAddEquipmentDialog ? (
              <div className="dialog-overlay" role="dialog" aria-modal="true">
                <div className="dialog-card">
                  <h3>Add Equipment</h3>
                  <label className="remark-field">
                    Asset ID
                    <input
                      type="text"
                      value={newEquipment.assetId}
                      onChange={(event) => {
                        setNewEquipment((prev) => ({ ...prev, assetId: event.target.value }))
                        if (equipmentDialogError) setEquipmentDialogError('')
                      }}
                      placeholder="e.g. A-001, type 0 if no asset id"
                    />
                  </label>
                  <label className="remark-field">
                    Equipment name
                    <input
                      type="text"
                      value={newEquipment.name}
                      onChange={(event) => {
                        setNewEquipment((prev) => ({ ...prev, name: event.target.value }))
                        if (equipmentDialogError) setEquipmentDialogError('')
                      }}
                      placeholder="e.g. Shower Chair"
                    />
                  </label>
                  <label className="remark-field">
                    Category
                    <input
                      type="text"
                      list="category-options"
                      value={newEquipment.category}
                      onChange={(event) => {
                        setNewEquipment((prev) => ({ ...prev, category: event.target.value }))
                        if (equipmentDialogError) setEquipmentDialogError('')
                      }}
                      placeholder="Select or type a new category"
                    />
                    <datalist id="category-options">
                      {categoryOptions.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    <small className="field-help">
                      Choose an existing category or type to create a new one.
                    </small>
                  </label>
                  <label className="remark-field">
                    Location
                    <select
                      value={newEquipment.area}
                      onChange={(event) => {
                        setNewEquipment((prev) => ({ ...prev, area: event.target.value }))
                        if (equipmentDialogError) setEquipmentDialogError('')
                      }}
                    >
                      {allLocations.map((locationName) => (
                        <option key={locationName} value={locationName}>
                          {locationName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="remark-field">
                    Remark
                    <input
                      type="text"
                      value={newEquipment.remark}
                      onChange={(event) =>
                        setNewEquipment((prev) => ({ ...prev, remark: event.target.value }))
                      }
                      placeholder="Type remarks"
                    />
                  </label>
                  {equipmentDialogError ? (
                    <p className="dialog-error">{equipmentDialogError}</p>
                  ) : null}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setShowAddEquipmentDialog(false)
                        setEquipmentDialogError('')
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="primary" onClick={handleCreateEquipment}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {showEditEquipmentDialog ? (
              <div className="dialog-overlay" role="dialog" aria-modal="true">
                <div className="dialog-card">
                  <h3>Edit Equipment</h3>
                  <label className="remark-field">
                    Asset ID
                    <input
                      type="text"
                      value={editEquipment.assetId}
                      onChange={(event) =>
                        setEditEquipment((prev) => ({ ...prev, assetId: event.target.value }))
                      }
                    />
                  </label>
                  <label className="remark-field">
                    Equipment name
                    <input
                      type="text"
                      value={editEquipment.name}
                      onChange={(event) =>
                        setEditEquipment((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </label>
                  <label className="remark-field">
                    Category
                    <input
                      type="text"
                      list="category-options"
                      value={editEquipment.category}
                      onChange={(event) =>
                        setEditEquipment((prev) => ({ ...prev, category: event.target.value }))
                      }
                    />
                  </label>
                  <label className="remark-field">
                    Location
                    <select
                      value={editEquipment.area}
                      onChange={(event) =>
                        setEditEquipment((prev) => ({ ...prev, area: event.target.value }))
                      }
                    >
                      {allLocations.map((locationName) => (
                        <option key={`edit-location-${locationName}`} value={locationName}>
                          {locationName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="remark-field">
                    Remark
                    <input
                      type="text"
                      value={editEquipment.remark}
                      onChange={(event) =>
                        setEditEquipment((prev) => ({ ...prev, remark: event.target.value }))
                      }
                    />
                  </label>
                  {editEquipmentError ? <p className="dialog-error">{editEquipmentError}</p> : null}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setShowEditEquipmentDialog(false)
                        setEditingEquipmentId('')
                        setEditEquipmentError('')
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="primary" onClick={handleSaveEditEquipment}>
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

          </section>
        ) : adminTab === 'category' ? (
          <section className="card admin-page">
            <div className="equipment-page-head">
              <div>
                <h2>Category</h2>
                <p className="equipment-area">Manage the equipment categories used in checks.</p>
              </div>
              <button
                type="button"
                className="add-equipment-btn"
                onClick={() => setShowAddCategoryDialog(true)}
              >
                + Add Category
              </button>
            </div>
            <div className="equipment-table-wrap">
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryOptions.map((category) => (
                    <tr key={category}>
                      <td>{category}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            aria-label="Edit"
                            onClick={() => handleStartEditCategory(category)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            aria-label="Delete"
                            onClick={() => requestDelete('category', category)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showAddCategoryDialog ? (
              <div className="dialog-overlay" role="dialog" aria-modal="true">
                <div className="dialog-card">
                  <h3>Add Category</h3>
                  <label className="remark-field">
                    Category name
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(event) => {
                        setNewCategoryName(event.target.value)
                        if (categoryDialogError) setCategoryDialogError('')
                      }}
                      placeholder="e.g. Mobility Aids"
                    />
                  </label>
                  {categoryDialogError ? <p className="dialog-error">{categoryDialogError}</p> : null}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setShowAddCategoryDialog(false)
                        setNewCategoryName('')
                        setCategoryDialogError('')
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="primary" onClick={handleCreateCategory}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {showEditCategoryDialog ? (
              <div className="dialog-overlay" role="dialog" aria-modal="true">
                <div className="dialog-card">
                  <h3>Edit Category</h3>
                  <label className="remark-field">
                    Category name
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(event) => {
                        setEditCategoryName(event.target.value)
                        if (editCategoryError) setEditCategoryError('')
                      }}
                    />
                  </label>
                  {editCategoryError ? <p className="dialog-error">{editCategoryError}</p> : null}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setShowEditCategoryDialog(false)
                        setEditingCategoryName('')
                        setEditCategoryName('')
                        setEditCategoryError('')
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="primary" onClick={handleSaveEditCategory}>
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

          </section>
        ) : adminTab === 'location' ? (
          <section className="card admin-page">
            <div className="equipment-page-head">
              <div>
                <h2>Location</h2>
                <p className="equipment-area">
                  Manage the locations and the location each one covers.
                </p>
              </div>
              <button
                type="button"
                className="add-equipment-btn"
                onClick={() => setShowAddLocationDialog(true)}
              >
                + Add Location
              </button>
            </div>

            <div className="equipment-table-wrap">
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locationRows.map((locationName, index) => (
                    <tr key={`${locationName}-${index}`}>
                      <td>{locationName}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            aria-label="Edit"
                            onClick={() => handleStartEditLocation(locationName)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            aria-label="Delete"
                            onClick={() => requestDelete('location', locationName)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showAddLocationDialog ? (
              <div className="dialog-overlay" role="dialog" aria-modal="true">
                <div className="dialog-card">
                  <h3>Add Location</h3>
                  <label className="remark-field">
                    Location name
                    <input
                      type="text"
                      value={newLocationName}
                      onChange={(event) => {
                        setNewLocationName(event.target.value)
                        if (locationDialogError) {
                          setLocationDialogError('')
                        }
                      }}
                      placeholder="e.g. 11/F IRA Zone E"
                    />
                  </label>
                  {locationDialogError ? (
                    <p className="dialog-error">{locationDialogError}</p>
                  ) : null}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setShowAddLocationDialog(false)
                        setNewLocationName('')
                        setLocationDialogError('')
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        const name = newLocationName.trim()
                        if (!name) return
                        const isDuplicate = locationRows.some(
                          (existing) => existing.toLowerCase() === name.toLowerCase(),
                        )
                        if (isDuplicate) {
                          setLocationDialogError('This location already exists.')
                          return
                        }
                        if (dbMode && supabase) {
                          void (async () => {
                            try {
                              const maxOrder = dbLocations.reduce(
                                (m, l) => Math.max(m, l.sort_order ?? 0),
                                0,
                              )
                              await insertLocation(supabase, name, maxOrder + 1)
                              await reloadFromDatabase()
                              setNewLocationName('')
                              setLocationDialogError('')
                              setShowAddLocationDialog(false)
                              setSyncError(null)
                            } catch (e) {
                              setLocationDialogError(e.message ?? String(e))
                            }
                          })()
                          return
                        }
                        setCustomLocations((prev) => [...prev, name])
                        setNewLocationName('')
                        setLocationDialogError('')
                        setShowAddLocationDialog(false)
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {showEditLocationDialog ? (
              <div className="dialog-overlay" role="dialog" aria-modal="true">
                <div className="dialog-card">
                  <h3>Edit Location</h3>
                  <label className="remark-field">
                    Location name
                    <input
                      type="text"
                      value={editLocationName}
                      onChange={(event) => {
                        setEditLocationName(event.target.value)
                        if (editLocationError) setEditLocationError('')
                      }}
                    />
                  </label>
                  {editLocationError ? <p className="dialog-error">{editLocationError}</p> : null}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setShowEditLocationDialog(false)
                        setEditingLocationName('')
                        setEditLocationName('')
                        setEditLocationError('')
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="primary" onClick={handleSaveEditLocation}>
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="card admin-page reports-page">
            <div className="equipment-page-head">
              <div>
                <h2>Reports &amp; Logs</h2>
                <p className="equipment-area">Detailed daily submission logs for auditing.</p>
              </div>
              <button type="button" className="export-btn" onClick={handleExportCsv}>
                ↧ Export to CSV
              </button>
            </div>

            <div className="report-filters">
              <label>
                <span>Month</span>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(event) => setReportMonth(event.target.value)}
                />
              </label>
              <label>
                <span>Location</span>
                <select value={reportZone} onChange={(event) => setReportZone(event.target.value)}>
                  <option value="all">All Locations</option>
                  {locationRows.map((locationName, index) => (
                    <option key={`${locationName}-report-${index}`} value={locationName}>
                      {locationName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={reportStatus}
                  onChange={(event) => setReportStatus(event.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="Good">Good</option>
                  <option value="NG">NG</option>
                  <option value="Leaned">Leaned</option>
                  <option value="Others">Others</option>
                </select>
              </label>
            </div>

            <div className="equipment-table-wrap">
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Equipment</th>
                    <th>Status</th>
                    <th>Checked By</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="reports-empty">
                        <div>⌯</div>
                        <p>No submission logs found for these filters.</p>
                      </td>
                    </tr>
                  ) : (
                    reportRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.date}</td>
                        <td>{row.time}</td>
                        <td>{row.zone}</td>
                        <td>{row.equipment}</td>
                        <td>
                          <span className={`report-status ${row.status.toLowerCase()}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.checkedBy}</td>
                        <td>{row.remark}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </section>
        )}

        {deleteConfirm ? (
          <div className="dialog-overlay" role="dialog" aria-modal="true">
            <div className="dialog-card">
              <h3>Confirm Delete</h3>
              <p className="equipment-area">
                Are you sure you want to delete{' '}
                {deleteConfirm.kind === 'equipment'
                  ? `"${deleteConfirm.payload.name}"`
                  : `"${deleteConfirm.payload}"`}
                ?
              </p>
              <div className="dialog-actions">
                <button type="button" className="ghost" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={confirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
