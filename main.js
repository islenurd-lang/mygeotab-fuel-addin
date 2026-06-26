(function () {
  "use strict";

  var root = window.geotab = window.geotab || {};
  root.addin = root.addin || {};

  let apiRef = null;
  let stateRef = null;
  let devicesCache = [];
  let diagnosticsCache = [];
  let selectedDeviceIds = [];
  let selectedDiagnosticIds = [];
  let eventsConfigured = false;
  let lastEmptyStatusDataDiagnostics = [];

  var ALLOWED_FUEL_DIAGNOSTIC_RULES = [
    {
      label: "Mid trip fuel data points valid",
      all: ["mid", "trip", "fuel", "data", "point", "valid"],
      variants: [
        "los puntos de datos de combustible a mitad de viaje son validos",
        "puntos de datos de combustible a mitad de viaje validos"
      ]
    },
    {
      label: "Fuel level percentage",
      anyAll: [
        ["fuel", "level", "percentage"],
        ["fuel", "level", "percent"],
        ["fuel", "level"],
        ["nivel", "combustible", "porcentaje"]
      ]
    },
    {
      label: "Trip distance with tracked fuel accumulator",
      anyAll: [
        ["trip", "distance", "fuel", "accumulator", "tracked"],
        ["distancia", "viaje", "acumulador", "combustible"],
        ["distancia", "viaje", "combustible", "orugas"]
      ]
    },
    {
      label: "Trip distance with tracked fuel",
      anyAll: [
        ["trip", "distance", "fuel", "tracked"],
        ["distancia", "viaje", "combustible", "rastreada"],
        ["distancia", "viaje", "combustible", "orugas"]
      ]
    },
    {
      label: "Trip distance with tracked fuel source",
      anyAll: [
        ["trip", "distance", "fuel", "source", "tracked"],
        ["distancia", "viaje", "fuente", "combustible", "rastreada"],
        ["distancia", "viaje", "fuente", "combustible", "rastread"]
      ]
    },
    {
      label: "Trip idle fuel used",
      anyAll: [
        ["trip", "idle", "fuel", "used"],
        ["combustible", "ralenti", "viaje", "utilizado"],
        ["combustible", "ralenti", "viaje", "usado"]
      ]
    },
    {
      label: "Trip fuel used",
      anyAll: [
        ["trip", "fuel", "used"],
        ["combustible", "viaje", "utilizado"],
        ["combustible", "viaje", "usado"]
      ]
    },
    {
      label: "Total fuel used since telematics device installation",
      anyAll: [
        ["total", "fuel", "used"],
        ["fuel", "used", "installation"],
        ["combustible", "total", "utilizado", "instalacion"],
        ["combustible", "total", "usado", "instalacion"]
      ]
    },
    {
      label: "Total idle fuel used since telematics device installation",
      anyAll: [
        ["total", "idle", "fuel", "used"],
        ["idle", "fuel", "used", "installation"],
        ["combustible", "total", "ralenti", "utilizado"],
        ["combustible", "total", "ralenti", "usado"]
      ]
    },
    {
      label: "Trip idle fuel used accumulation",
      anyAll: [
        ["trip", "idle", "fuel", "used", "accumulation"],
        ["idle", "fuel", "accumulation", "trip"],
        ["acumulacion", "combustible", "ralenti", "viaje"],
        ["acumulacion", "combustible", "usado", "ralenti", "viaje"]
      ]
    },
    {
      label: "Trip fuel accumulator",
      anyAll: [
        ["trip", "fuel", "accumulator"],
        ["acumulador", "combustible", "viaje"]
      ]
    }
  ];

  var FUEL_DIAGNOSTIC_EXCLUSIONS = [
    "exhaust",
    "escape",
    "gases de escape",
    "emission",
    "emissions",
    "emisiones",
    "aftertreatment",
    "nox",
    "oxygen",
    "oxigeno",
    "o2",
    "egr",
    "scr",
    "def",
    "diesel exhaust fluid",
    "urea",
    "adblue",
    "sensor de gas",
    "sensores de gases",
    "gas pressure",
    "presion de gas",
    "gas temperature",
    "temperatura de gas",
    "cng",
    "lng",
    "propane",
    "propano",
    "natural gas",
    "gas natural",
    "lpg"
  ];

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var element = getElement(id);

    if (element) {
      element.textContent = text;
    }
  }

  function setStatusMessage(message) {
    setText("statusMessage", message);
  }

  function toDateTimeLocalValue(date) {
    var offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  function setDefaultDates() {
    var fromDate = getElement("fromDate");
    var toDate = getElement("toDate");
    var now = new Date();
    var yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (fromDate && !fromDate.value) {
      fromDate.value = toDateTimeLocalValue(yesterday);
    }

    if (toDate && !toDate.value) {
      toDate.value = toDateTimeLocalValue(now);
    }
  }

  function setQueryButtonDisabled(disabled) {
    var button = getElement("queryButton");

    if (button) {
      button.disabled = disabled;
      button.textContent = disabled ? "Consultando..." : "Consultar";
    }
  }

  function setLoading(isLoading) {
    var loadingMessage = getElement("loadingMessage");

    if (loadingMessage) {
      loadingMessage.hidden = !isLoading;
    }
  }

  function showError(message) {
    var errorMessage = getElement("errorMessage");

    if (errorMessage) {
      errorMessage.textContent = message || "No se pudo completar la operacion.";
      errorMessage.hidden = false;
    }
  }

  function clearError() {
    var errorMessage = getElement("errorMessage");

    if (errorMessage) {
      errorMessage.textContent = "";
      errorMessage.hidden = true;
    }
  }

  function apiCall(method, params) {
    return new Promise(function (resolve, reject) {
      if (!apiRef || typeof apiRef.call !== "function") {
        reject(new Error("El SDK de MyGeotab no esta disponible."));
        return;
      }

      console.log("[Panel Combustible] api.call request:", method, params);

      apiRef.call(
        method,
        params,
        function (result) {
          console.log("[Panel Combustible] api.call success:", method, result);
          resolve(result);
        },
        function (error) {
          console.error("[Panel Combustible] api.call error:", method, error);
          reject(error);
        }
      );
    });
  }

  function ensureSdkAvailable() {
    if (!apiRef || typeof apiRef.call !== "function") {
      setText("sdkStatus", "SDK no disponible");
      setStatusMessage("Este Add-In debe abrirse dentro de MyGeotab para usar el SDK.");
      return false;
    }

    setText("sdkStatus", "SDK disponible");
    setStatusMessage("SDK disponible.");
    return true;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9%]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getDeviceLabel(device) {
    return device.name || device.serialNumber || device.id || "Vehiculo sin identificar";
  }

  function getDeviceSearchText(device) {
    return [
      device.name,
      device.serialNumber,
      device.id
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function getDiagnosticUnitName(diagnostic) {
    if (diagnostic && diagnostic.unitOfMeasure && diagnostic.unitOfMeasure.name) {
      return diagnostic.unitOfMeasure.name;
    }

    return "";
  }

  function getDiagnosticLabel(diagnostic) {
    var unit = getDiagnosticUnitName(diagnostic);
    var label = diagnostic.name || diagnostic.code || diagnostic.id;

    return unit ? label + " (" + unit + ")" : label;
  }

  function getDiagnosticSearchText(diagnostic) {
    return normalizeText([
      diagnostic.name,
      diagnostic.code,
      diagnostic.source && diagnostic.source.name,
      diagnostic.diagnosticType,
      diagnostic.unitOfMeasure && diagnostic.unitOfMeasure.name
    ].filter(Boolean).join(" "));
  }

  function textContainsAll(text, words) {
    return words.every(function (word) {
      return text.indexOf(normalizeText(word)) !== -1;
    });
  }

  function matchesAllowedFuelRule(text, rule) {
    if (rule.all && textContainsAll(text, rule.all)) {
      return true;
    }

    if (rule.variants && rule.variants.some(function (variant) {
      return text.indexOf(normalizeText(variant)) !== -1;
    })) {
      return true;
    }

    if (rule.anyAll && rule.anyAll.some(function (words) {
      return textContainsAll(text, words);
    })) {
      return true;
    }

    return false;
  }

  function isFuelDiagnostic(diagnostic) {
    var text = getDiagnosticSearchText(diagnostic || {});
    var hasExcludedTerm = FUEL_DIAGNOSTIC_EXCLUSIONS.some(function (keyword) {
      return text.indexOf(normalizeText(keyword)) !== -1;
    });
    var isWhitelisted = ALLOWED_FUEL_DIAGNOSTIC_RULES.some(function (rule) {
      return matchesAllowedFuelRule(text, rule);
    });

    return isWhitelisted && !hasExcludedTerm;
  }

  function getSelectedDevices() {
    return selectedDeviceIds.map(function (id) {
      return devicesCache.find(function (device) {
        return device.id === id;
      });
    }).filter(Boolean);
  }

  function getSelectedDiagnostics() {
    return selectedDiagnosticIds.map(function (id) {
      return diagnosticsCache.find(function (diagnostic) {
        return diagnostic.id === id;
      });
    }).filter(Boolean);
  }

  function createOptionButton(label, isSelected, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = isSelected ? "multi-select-option is-selected" : "multi-select-option";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderTags(containerId, items, removeHandler) {
    var container = getElement(containerId);

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (items.length === 0) {
      var empty = document.createElement("span");
      empty.className = "selected-tags-empty";
      empty.textContent = "Sin seleccion.";
      container.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var tag = document.createElement("span");
      var removeButton = document.createElement("button");
      tag.className = "selected-tag";
      tag.appendChild(document.createTextNode(item.label));
      removeButton.type = "button";
      removeButton.textContent = "x";
      removeButton.setAttribute("aria-label", "Quitar " + item.label);
      removeButton.addEventListener("click", function () {
        removeHandler(item.id);
      });
      tag.appendChild(removeButton);
      container.appendChild(tag);
    });
  }

  function renderVehicleOptions() {
    var options = getElement("vehicleOptions");
    var input = getElement("vehicleSearchInput");
    var query = normalizeText(input && input.value);
    var matches = devicesCache.filter(function (device) {
      return !query || getDeviceSearchText(device).indexOf(query) !== -1;
    }).slice(0, 100);

    if (!options) {
      return;
    }

    options.innerHTML = "";

    if (devicesCache.length === 0) {
      options.textContent = "No hay vehiculos disponibles.";
      return;
    }

    if (matches.length === 0) {
      options.textContent = "No hay coincidencias.";
      return;
    }

    matches.forEach(function (device) {
      options.appendChild(createOptionButton(
        getDeviceLabel(device),
        selectedDeviceIds.indexOf(device.id) !== -1,
        function () {
          toggleVehicle(device.id);
        }
      ));
    });
  }

  function renderDiagnosticOptions() {
    var options = getElement("diagnosticOptions");
    var input = getElement("diagnosticSearchInput");
    var query = normalizeText(input && input.value);
    var matches = diagnosticsCache.filter(function (diagnostic) {
      return !query || getDiagnosticSearchText(diagnostic).indexOf(query) !== -1;
    }).slice(0, 100);

    if (!options) {
      return;
    }

    options.innerHTML = "";

    if (diagnosticsCache.length === 0) {
      options.textContent = "No hay diagnosticos de combustible.";
      return;
    }

    if (matches.length === 0) {
      options.textContent = "No hay coincidencias.";
      return;
    }

    matches.forEach(function (diagnostic) {
      options.appendChild(createOptionButton(
        getDiagnosticLabel(diagnostic),
        selectedDiagnosticIds.indexOf(diagnostic.id) !== -1,
        function () {
          toggleDiagnostic(diagnostic.id);
        }
      ));
    });
  }

  function renderSelectedVehicles() {
    renderTags("selectedVehicles", getSelectedDevices().map(function (device) {
      return { id: device.id, label: getDeviceLabel(device) };
    }), removeVehicle);
  }

  function renderSelectedDiagnostics() {
    renderTags("selectedDiagnostics", getSelectedDiagnostics().map(function (diagnostic) {
      return { id: diagnostic.id, label: getDiagnosticLabel(diagnostic) };
    }), removeDiagnostic);
  }

  function refreshVehicleUi() {
    renderVehicleOptions();
    renderSelectedVehicles();
  }

  function refreshDiagnosticUi() {
    renderDiagnosticOptions();
    renderSelectedDiagnostics();
  }

  function toggleVehicle(deviceId) {
    if (selectedDeviceIds.indexOf(deviceId) === -1) {
      selectedDeviceIds.push(deviceId);
    } else {
      removeVehicle(deviceId);
      return;
    }

    refreshVehicleUi();
  }

  function toggleDiagnostic(diagnosticId) {
    if (selectedDiagnosticIds.indexOf(diagnosticId) === -1) {
      selectedDiagnosticIds.push(diagnosticId);
    } else {
      removeDiagnostic(diagnosticId);
      return;
    }

    refreshDiagnosticUi();
  }

  function removeVehicle(deviceId) {
    selectedDeviceIds = selectedDeviceIds.filter(function (id) {
      return id !== deviceId;
    });
    refreshVehicleUi();
  }

  function removeDiagnostic(diagnosticId) {
    selectedDiagnosticIds = selectedDiagnosticIds.filter(function (id) {
      return id !== diagnosticId;
    });
    refreshDiagnosticUi();
  }

  async function loadDevices() {
    var devices;

    console.log("[Panel Combustible] Cargando vehiculos...");
    setStatusMessage("Cargando vehiculos...");

    devices = await apiCall("Get", {
      typeName: "Device",
      resultsLimit: 1000
    });

    devicesCache = Array.isArray(devices) ? devices : [];
    selectedDeviceIds = selectedDeviceIds.filter(function (id) {
      return devicesCache.some(function (device) {
        return device.id === id;
      });
    });

    console.log("[Panel Combustible] Vehiculos cargados:", devicesCache.length);
    console.table(devicesCache.slice(0, 20));

    if (devicesCache.length === 0) {
      showError("No se encontraron vehiculos visibles para este usuario. Verifica permisos y grupos en MyGeotab.");
      setStatusMessage("Vehiculos cargados: 0.");
    } else {
      setStatusMessage("Vehiculos cargados: " + devicesCache.length + ".");
    }

    refreshVehicleUi();
  }

  async function loadFuelDiagnostics() {
    var diagnostics;
    var allDiagnostics;

    console.log("[Panel Combustible] Cargando diagnosticos...");
    setStatusMessage("Cargando diagnosticos...");

    diagnostics = await apiCall("Get", {
      typeName: "Diagnostic",
      resultsLimit: 5000
    });

    allDiagnostics = Array.isArray(diagnostics) ? diagnostics : [];
    diagnosticsCache = allDiagnostics.filter(isFuelDiagnostic);
    selectedDiagnosticIds = selectedDiagnosticIds.filter(function (id) {
      return diagnosticsCache.some(function (diagnostic) {
        return diagnostic.id === id;
      });
    });

    console.log("[Panel Combustible] Total diagnosticos:", allDiagnostics.length);
    console.table(allDiagnostics.slice(0, 20));
    console.log("[Panel Combustible] Diagnosticos de combustible:", diagnosticsCache.length);
    console.table(diagnosticsCache.slice(0, 20));

    if (diagnosticsCache.length === 0) {
      showError("No se encontraron diagnosticos relacionados con combustible.");
      setStatusMessage("Diagnosticos de combustible cargados: 0.");
    } else {
      setStatusMessage("Diagnosticos cargados: " + diagnosticsCache.length + ".");
    }

    refreshDiagnosticUi();
  }

  function validateDateRange() {
    var fromDateInput = getElement("fromDate");
    var toDateInput = getElement("toDate");
    var fromInput = fromDateInput ? fromDateInput.value : "";
    var toInput = toDateInput ? toDateInput.value : "";
    var fromDate;
    var toDate;

    if (!fromInput || !toInput) {
      throw new Error("Debe seleccionar fecha inicial y fecha final.");
    }

    fromDate = new Date(fromInput);
    toDate = new Date(toInput);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error("El rango de fechas no es valido.");
    }

    if (fromDate > toDate) {
      throw new Error("La fecha inicial no puede ser mayor que la fecha final.");
    }

    return {
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString()
    };
  }

  async function queryFuelStatusData() {
    var selectedDevices = getSelectedDevices();
    var selectedDiagnostics = getSelectedDiagnostics();
    var range = validateDateRange();
    var allRows = [];
    var deviceIndex;
    var diagnosticIndex;

    if (selectedDevices.length === 0) {
      throw new Error("Debe seleccionar al menos un vehiculo.");
    }

    if (selectedDiagnostics.length === 0) {
      throw new Error("Debe seleccionar al menos un diagnostico.");
    }

    console.group("[Panel Combustible] Consulta StatusData");
    console.log("[Panel Combustible] Vehiculos seleccionados:", selectedDevices.map(function (device) {
      return { id: device.id, name: getDeviceLabel(device) };
    }));
    console.log("[Panel Combustible] Diagnosticos seleccionados:", selectedDiagnostics.map(function (diagnostic) {
      return { id: diagnostic.id, name: diagnostic.name || diagnostic.code || diagnostic.id };
    }));
    console.log("[Panel Combustible] Rango ISO:", range);

    for (deviceIndex = 0; deviceIndex < selectedDevices.length; deviceIndex += 1) {
      for (diagnosticIndex = 0; diagnosticIndex < selectedDiagnostics.length; diagnosticIndex += 1) {
        var device = selectedDevices[deviceIndex];
        var diagnostic = selectedDiagnostics[diagnosticIndex];
        var params = {
          typeName: "StatusData",
          search: {
            deviceSearch: {
              id: device.id
            },
            diagnosticSearch: {
              id: diagnostic.id
            },
            fromDate: range.fromDate,
            toDate: range.toDate
          },
          resultsLimit: 5000
        };
        var rows;

        console.log("[Panel Combustible] Consultando StatusData:", params);
        rows = await apiCall("Get", params);
        rows = Array.isArray(rows) ? rows : [];

        console.log("[Panel Combustible] Registros StatusData:", rows.length);
        console.table(rows.slice(0, 20));

        rows.forEach(function (row) {
          allRows.push({
            raw: row,
            device: device,
            diagnostic: diagnostic
          });
        });
      }
    }

    console.log("[Panel Combustible] Total combinado StatusData:", allRows.length);
    console.groupEnd();

    if (allRows.length === 0) {
      lastEmptyStatusDataDiagnostics = await diagnoseEmptyStatusData(selectedDevices, selectedDiagnostics, range);
    } else {
      lastEmptyStatusDataDiagnostics = [];
    }

    return allRows;
  }

  function createStatusDataParams(deviceId, diagnosticId, range, resultsLimit) {
    var search = {};

    if (deviceId) {
      search.deviceSearch = {
        id: deviceId
      };
    }

    if (diagnosticId) {
      search.diagnosticSearch = {
        id: diagnosticId
      };
    }

    if (range) {
      search.fromDate = range.fromDate;
      search.toDate = range.toDate;
    }

    return {
      typeName: "StatusData",
      search: search,
      resultsLimit: resultsLimit || 1,
      sort: {
        sortBy: "dateTime",
        sortDirection: "desc"
      }
    };
  }

  async function probeStatusData(label, params) {
    var rows;

    console.log("[Panel Combustible] Diagnostico StatusData - " + label + ":", params);

    try {
      rows = await apiCall("Get", params);
      rows = Array.isArray(rows) ? rows : [];
      console.log("[Panel Combustible] Diagnostico StatusData resultado - " + label + ":", rows.length, rows[0] || null);
      return {
        label: label,
        count: rows.length,
        first: rows[0] || null,
        error: null
      };
    } catch (error) {
      console.error("[Panel Combustible] Diagnostico StatusData error - " + label + ":", error);
      return {
        label: label,
        count: 0,
        first: null,
        error: error
      };
    }
  }

  async function diagnoseEmptyStatusData(selectedDevices, selectedDiagnostics, range) {
    var diagnostics = [];
    var firstDevice = selectedDevices[0];
    var firstDiagnostic = selectedDiagnostics[0];
    var comboLimit = Math.min(selectedDevices.length * selectedDiagnostics.length, 5);
    var checked = 0;
    var deviceIndex;
    var diagnosticIndex;

    console.group("[Panel Combustible] Diagnostico por StatusData sin registros");
    console.log("[Panel Combustible] No hubo datos en la consulta exacta. Ejecutando pruebas livianas resultsLimit=1.");

    for (deviceIndex = 0; deviceIndex < selectedDevices.length && checked < comboLimit; deviceIndex += 1) {
      for (diagnosticIndex = 0; diagnosticIndex < selectedDiagnostics.length && checked < comboLimit; diagnosticIndex += 1) {
        var device = selectedDevices[deviceIndex];
        var diagnostic = selectedDiagnostics[diagnosticIndex];
        diagnostics.push(await probeStatusData(
          "mismo vehiculo y diagnostico sin rango - " + getDeviceLabel(device) + " / " + (diagnostic.name || diagnostic.id),
          createStatusDataParams(device.id, diagnostic.id, null, 1)
        ));
        checked += 1;
      }
    }

    if (firstDiagnostic) {
      diagnostics.push(await probeStatusData(
        "diagnostico seleccionado en cualquier vehiculo dentro del rango",
        createStatusDataParams(null, firstDiagnostic.id, range, 1)
      ));
    }

    if (firstDevice) {
      diagnostics.push(await probeStatusData(
        "vehiculo seleccionado con cualquier StatusData dentro del rango",
        createStatusDataParams(firstDevice.id, null, range, 1)
      ));
    }

    console.table(diagnostics.map(function (item) {
      return {
        prueba: item.label,
        registros: item.count,
        fechaPrimerRegistro: item.first && item.first.dateTime ? item.first.dateTime : "",
        error: item.error ? String(item.error.message || item.error) : ""
      };
    }));
    console.groupEnd();

    return diagnostics;
  }

  function getEmptyStatusDataMessage() {
    var hasHistoricalComboData = lastEmptyStatusDataDiagnostics.some(function (item) {
      return item.label.indexOf("mismo vehiculo y diagnostico sin rango") === 0 && item.count > 0;
    });
    var hasDiagnosticRangeData = lastEmptyStatusDataDiagnostics.some(function (item) {
      return item.label === "diagnostico seleccionado en cualquier vehiculo dentro del rango" && item.count > 0;
    });
    var hasDeviceRangeData = lastEmptyStatusDataDiagnostics.some(function (item) {
      return item.label === "vehiculo seleccionado con cualquier StatusData dentro del rango" && item.count > 0;
    });

    if (hasHistoricalComboData) {
      return "No hay datos en el rango seleccionado, pero si existen datos historicos para alguna combinacion vehiculo/diagnostico. Prueba ampliar el rango de fechas.";
    }

    if (hasDiagnosticRangeData) {
      return "El diagnostico tiene datos en el rango, pero no para los vehiculos seleccionados.";
    }

    if (hasDeviceRangeData) {
      return "El vehiculo reporta StatusData en el rango, pero no para los diagnosticos de combustible seleccionados.";
    }

    return "No se encontraron datos para los filtros seleccionados. Revisa consola: se ejecutaron pruebas de diagnostico StatusData con resultsLimit=1.";
  }

  function appendCell(row, value) {
    var cell = document.createElement("td");
    cell.textContent = value === undefined || value === null || value === "" ? "-" : String(value);
    row.appendChild(cell);
  }

  function renderRows(rows) {
    var tbody = getElement("resultBody");

    if (!tbody) {
      console.error("[Panel Combustible] No existe resultBody.");
      return;
    }

    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 7;
      emptyCell.className = "empty-cell";
      emptyCell.textContent = getEmptyStatusDataMessage();
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    rows.sort(function (a, b) {
      return new Date(b.raw.dateTime || 0).getTime() - new Date(a.raw.dateTime || 0).getTime();
    });

    rows.forEach(function (item) {
      var row = document.createElement("tr");
      var raw = item.raw;

      appendCell(row, getDeviceLabel(item.device));
      appendCell(row, raw.dateTime ? new Date(raw.dateTime).toLocaleString() : "");
      appendCell(row, item.diagnostic.name || item.diagnostic.id);
      appendCell(row, raw.data !== undefined && raw.data !== null ? raw.data : raw.value);
      appendCell(row, getDiagnosticUnitName(item.diagnostic));
      appendCell(row, item.device.id);
      appendCell(row, item.diagnostic.id);
      tbody.appendChild(row);
    });
  }

  async function handleQueryClick() {
    clearError();
    setLoading(true);
    setQueryButtonDisabled(true);
    setStatusMessage("Consultando StatusData...");

    try {
      var rows = await queryFuelStatusData();
      renderRows(rows);
      setStatusMessage(rows.length > 0 ? "Registros encontrados: " + rows.length + "." : getEmptyStatusDataMessage());
    } catch (error) {
      console.error("[Panel Combustible] Error consultando StatusData:", error);
      showError(error.message || "No se pudieron consultar los datos de combustible.");
    } finally {
      setLoading(false);
      setQueryButtonDisabled(false);
    }
  }

  function setEmptyRows(message) {
    var tbody = getElement("resultBody");
    var row;
    var cell;

    if (!tbody) {
      return;
    }

    tbody.innerHTML = "";
    row = document.createElement("tr");
    cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "empty-cell";
    cell.textContent = message || "Sin resultados para mostrar.";
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function clearForm() {
    var vehicleSearchInput = getElement("vehicleSearchInput");
    var diagnosticSearchInput = getElement("diagnosticSearchInput");
    var fromDate = getElement("fromDate");
    var toDate = getElement("toDate");

    clearError();
    setLoading(false);
    setQueryButtonDisabled(false);
    selectedDeviceIds = [];
    selectedDiagnosticIds = [];

    if (vehicleSearchInput) {
      vehicleSearchInput.value = "";
    }

    if (diagnosticSearchInput) {
      diagnosticSearchInput.value = "";
    }

    if (fromDate) {
      fromDate.value = "";
    }

    if (toDate) {
      toDate.value = "";
    }

    setDefaultDates();
    refreshVehicleUi();
    refreshDiagnosticUi();
    setEmptyRows("Sin resultados para mostrar.");
    setStatusMessage("Filtros limpiados.");
  }

  function bindEvents() {
    var queryButton = getElement("queryButton");
    var clearButton = getElement("clearButton");
    var vehicleSearchInput = getElement("vehicleSearchInput");
    var diagnosticSearchInput = getElement("diagnosticSearchInput");

    if (eventsConfigured) {
      return;
    }

    if (queryButton) {
      queryButton.addEventListener("click", handleQueryClick);
    }

    if (clearButton) {
      clearButton.addEventListener("click", clearForm);
    }

    if (vehicleSearchInput) {
      vehicleSearchInput.addEventListener("input", renderVehicleOptions);
    }

    if (diagnosticSearchInput) {
      diagnosticSearchInput.addEventListener("input", renderDiagnosticOptions);
    }

    eventsConfigured = true;
  }

  root.addin.panelCombustible = function () {
    return {
      initialize: function (api, state, callback) {
        console.log("[Panel Combustible] initialize ejecutado");
        console.log("[Panel Combustible] api disponible:", !!api);

        apiRef = api;
        stateRef = state;

        bindEvents();
        setDefaultDates();
        refreshVehicleUi();
        refreshDiagnosticUi();
        ensureSdkAvailable();

        if (typeof callback === "function") {
          callback();
        }
      },

      focus: async function (api, state) {
        console.log("[Panel Combustible] focus ejecutado");
        console.log("[Panel Combustible] api disponible:", !!api);

        apiRef = api;
        stateRef = state;

        bindEvents();
        setDefaultDates();
        clearError();
        ensureSdkAvailable();
        setLoading(true);

        try {
          await loadDevices();
          await loadFuelDiagnostics();
        } catch (error) {
          console.error("[Panel Combustible] Error en focus:", error);
          showError("No se pudieron cargar los datos iniciales. Revisa la consola del navegador.");
        } finally {
          setLoading(false);
        }
      },

      blur: function () {
        console.log("[Panel Combustible] blur ejecutado");
      }
    };
  };

  document.addEventListener("DOMContentLoaded", function () {
    bindEvents();
    setDefaultDates();
    refreshVehicleUi();
    refreshDiagnosticUi();
    ensureSdkAvailable();
  });
}());
