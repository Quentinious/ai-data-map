import { useState } from "react";
import type { SnapshotFilters, UserType } from "../types/areaSnapshot";

type FiltersPanelProps = {
  onApply: (filters: SnapshotFilters) => void;
  activeFilters: SnapshotFilters;
};

type DraftFilters = {
  rooms: string;
  minArea: string;
  maxArea: string;
  minPrice: string;
  maxPrice: string;
  userType: UserType | "";
};

const USER_TYPE_LABELS: Record<UserType | "", string> = {
  "": "Все",
  any: "Все",
  private: "Частные",
  agency: "Агентства",
};

function filtersToChips(filters: SnapshotFilters): string[] {
  const chips: string[] = [];
  if (filters.rooms !== undefined) chips.push(`${filters.rooms}-к`);
  if (filters.minArea !== undefined) chips.push(`от ${filters.minArea} м²`);
  if (filters.maxArea !== undefined) chips.push(`до ${filters.maxArea} м²`);
  if (filters.minPrice !== undefined) chips.push(`от ${filters.minPrice.toLocaleString("ru-RU")} ₽`);
  if (filters.maxPrice !== undefined) chips.push(`до ${filters.maxPrice.toLocaleString("ru-RU")} ₽`);
  if (filters.userType !== undefined && filters.userType !== "any") {
    chips.push(USER_TYPE_LABELS[filters.userType]);
  }
  return chips;
}

function hasActiveFilters(filters: SnapshotFilters): boolean {
  return Object.keys(filters).length > 0;
}

export function FiltersPanel({ onApply, activeFilters }: FiltersPanelProps) {
  const [draft, setDraft] = useState<DraftFilters>({
    rooms: activeFilters.rooms !== undefined ? String(activeFilters.rooms) : "",
    minArea: activeFilters.minArea !== undefined ? String(activeFilters.minArea) : "",
    maxArea: activeFilters.maxArea !== undefined ? String(activeFilters.maxArea) : "",
    minPrice: activeFilters.minPrice !== undefined ? String(activeFilters.minPrice) : "",
    maxPrice: activeFilters.maxPrice !== undefined ? String(activeFilters.maxPrice) : "",
    userType: activeFilters.userType ?? "",
  });

  const handleApply = () => {
    const filters: SnapshotFilters = {};
    const rooms = draft.rooms ? Number(draft.rooms) : undefined;
    if (rooms !== undefined && !Number.isNaN(rooms)) filters.rooms = rooms;

    const minArea = draft.minArea ? Number(draft.minArea) : undefined;
    if (minArea !== undefined && !Number.isNaN(minArea)) filters.minArea = minArea;

    const maxArea = draft.maxArea ? Number(draft.maxArea) : undefined;
    if (maxArea !== undefined && !Number.isNaN(maxArea)) filters.maxArea = maxArea;

    const minPrice = draft.minPrice ? Number(draft.minPrice) : undefined;
    if (minPrice !== undefined && !Number.isNaN(minPrice)) filters.minPrice = minPrice;

    const maxPrice = draft.maxPrice ? Number(draft.maxPrice) : undefined;
    if (maxPrice !== undefined && !Number.isNaN(maxPrice)) filters.maxPrice = maxPrice;

    if (draft.userType && draft.userType !== "any") filters.userType = draft.userType as UserType;

    onApply(filters);
  };

  const handleReset = () => {
    setDraft({ rooms: "", minArea: "", maxArea: "", minPrice: "", maxPrice: "", userType: "" });
    onApply({});
  };

  const chips = filtersToChips(activeFilters);

  return (
    <div className="filters-panel">
      <h4 className="filters-title">Фильтры</h4>

      <div className="filters-row">
        <label className="filters-label">
          Комнат
          <select
            className="filters-select"
            value={draft.rooms}
            onChange={(e) => setDraft((d) => ({ ...d, rooms: e.target.value }))}
          >
            <option value="">Все</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </label>

        <label className="filters-label">
          Тип продавца
          <select
            className="filters-select"
            value={draft.userType}
            onChange={(e) => setDraft((d) => ({ ...d, userType: e.target.value as UserType | "" }))}
          >
            <option value="">Все</option>
            <option value="private">Частные</option>
            <option value="agency">Агентства</option>
          </select>
        </label>

        <label className="filters-label">
          Площадь, м²
          <div className="filters-range">
            <input
              type="number"
              className="filters-input"
              placeholder="от"
              min={0}
              value={draft.minArea}
              onChange={(e) => setDraft((d) => ({ ...d, minArea: e.target.value }))}
            />
            <span className="filters-dash">–</span>
            <input
              type="number"
              className="filters-input"
              placeholder="до"
              min={0}
              value={draft.maxArea}
              onChange={(e) => setDraft((d) => ({ ...d, maxArea: e.target.value }))}
            />
          </div>
        </label>

        <label className="filters-label">
          Цена, ₽
          <div className="filters-range">
            <input
              type="number"
              className="filters-input"
              placeholder="от"
              min={0}
              value={draft.minPrice}
              onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value }))}
            />
            <span className="filters-dash">–</span>
            <input
              type="number"
              className="filters-input"
              placeholder="до"
              min={0}
              value={draft.maxPrice}
              onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value }))}
            />
          </div>
        </label>
      </div>

      <div className="filters-actions">
        <button type="button" className="retry-button" onClick={handleApply}>
          Применить
        </button>
        {hasActiveFilters(activeFilters) && (
          <button type="button" className="filters-reset" onClick={handleReset}>
            Сбросить
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="filters-chips" aria-label="Активные фильтры">
          {chips.map((chip) => (
            <span key={chip} className="filter-chip">
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
