(function () {
  "use strict";

  var root = window.geotab = window.geotab || {};
  root.addin = root.addin || {};

  var apiRef = null;
  var stateRef = null;
  var devicesCache = [];
  var diagnosticsCache = [];
  var eventsConfigured = false;

  var FUEL_KEYWORDS = [
    "fuel",
    "combustible",
    "gas",
    "diesel",
    "tank",
    "level",
    "used",
    "consumption",
    "economy",
    "rate",
    "idle fuel",
    "fuel used",
    "fuel level",
    "total fuel",
    "fuel economy"
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

  function addOption(select, value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function apiCall(method, params) {
    return new Promise(function (resolve, reject) {
      if (!apiRef || typeof apiRef.call !== "function") {
        reject(new Error("El SDK de MyGeotab no esta disponible."));
        return;
      }

      console.log("[Panel Combustible] api.call:", method, params);

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

  function getDeviceLabel(device) {
    return device.name || device.serialNumber || device.id || "Vehiculo sin identificar";
  }

  function getSelectedDevice() {
    var select = getElement("deviceSelect");
    var deviceId = select ? select.value : "";

    return devicesCache.find(function (device) {
      return device.id === deviceId;
    });
  }

  function getSelectedDiagnostic() {
    var select = getElement("diagnosticSelect");
    var diagnosticId = select ? select.value : "";

    return diagnosticsCache.find(function (diagnostic) {
      return diagnostic.id === diagnosticId;
    });
  }

  function getDiagnosticUnitName(diagnostic) {
    if (diagnostic && diagnostic.unitOfMeasure && diagnostic.unitOfMeasure.name) {
      return diagnostic.unitOfMeasure.name;
    }

    return "";
  }

  function isFuelDiagnostic(diagnostic) {
    var text = [
      diagnostic.name,
      diagnostic.code,
      diagnostic.source && diagnostic.source.name,
      diagnostic.diagnosticType,
      diagnostic.unitOfMeasure && diagnostic.unitOfMeasure.name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return FUEL_KEYWORDS.some(function (keyword) {
      return text.indexOf(keyword.toLowerCase()) !== -1;
    });
  }

  async function loadDevices() {
    var select = getElement("deviceSelect");
    var devices;

    console.log("[Panel Combustible] Cargando vehiculos...");
    setStatusMessage("Cargando vehiculos...");

    if (!select) {
      throw new Error("No existe el elemento deviceSelect en el HTML.");
    }

    select.innerHTML = "";
    addOption(select, "", "Cargando vehiculos...");

    devices = await apiCall("Get", {
      typeName: "Device",
      resultsLimit: 1000,
      sort: {
        sortBy: "name",
        sortDirection: "asc"
      }
    });

    devicesCache = Array.isArray(devices) ? devices : [];

    console.log("[Panel Combustible] Vehiculos cargados:", devicesCache.length);
    console.table(devicesCache.slice(0, 10));

    select.innerHTML = "";

    if (devicesCache.length === 0) {
      addOption(select, "", "No hay vehiculos disponibles");
      showError("No se encontraron vehiculos visibles para este usuario. Verifica permisos y grupos en MyGeotab.");
      setStatusMessage("Vehiculos cargados: 0.");
      return;
    }

    addOption(select, "", "Seleccione un vehiculo");

    devicesCache.forEach(function (device) {
      addOption(select, device.id, getDeviceLabel(device));
    });

    setStatusMessage("Vehiculos cargados: " + devicesCache.length + ".");
  }

  async function loadFuelDiagnostics() {
    var select = getElement("diagnosticSelect");
    var diagnostics;
    var allDiagnostics;

    console.log("[Panel Combustible] Cargando diagnosticos...");
    setStatusMessage("Cargando diagnosticos...");

    if (!select) {
      throw new Error("No existe el elemento diagnosticSelect en el HTML.");
    }

    select.innerHTML = "";
    addOption(select, "", "Cargando diagnosticos...");

    diagnostics = await apiCall("Get", {
      typeName: "Diagnostic",
      resultsLimit: 5000
    });

    allDiagnostics = Array.isArray(diagnostics) ? diagnostics : [];

    console.log("[Panel Combustible] Total diagnosticos:", allDiagnostics.length);
    console.table(allDiagnostics.slice(0, 10));

    diagnosticsCache = allDiagnostics.filter(isFuelDiagnostic);

    console.log("[Panel Combustible] Diagnosticos combustible:", diagnosticsCache.length);
    console.table(diagnosticsCache.slice(0, 20));

    select.innerHTML = "";

    if (diagnosticsCache.length === 0) {
      addOption(select, "", "No hay diagnosticos de combustible");
      showError("No se encontraron diagnosticos relacionados con combustible. Revisa si la base tiene datos de motor disponibles.");
      setStatusMessage("Diagnosticos de combustible cargados: 0.");
      return;
    }

    addOption(select, "", "Seleccione un diagnostico");

    diagnosticsCache.forEach(function (diagnostic) {
      var unit = getDiagnosticUnitName(diagnostic);
      var label = diagnostic.name || diagnostic.id;

      addOption(select, diagnostic.id, unit ? label + " (" + unit + ")" : label);
    });

    setStatusMessage("Diagnosticos cargados: " + diagnosticsCache.length + ".");
  }

  async function queryFuelStatusData() {
    var deviceSelect = getElement("deviceSelect");
    var diagnosticSelect = getElement("diagnosticSelect");
    var fromDateInput = getElement("fromDate");
    var toDateInput = getElement("toDate");
    var deviceId = deviceSelect ? deviceSelect.value : "";
    var diagnosticId = diagnosticSelect ? diagnosticSelect.value : "";
    var fromInput = fromDateInput ? fromDateInput.value : "";
    var toInput = toDateInput ? toDateInput.value : "";
    var fromDate;
    var toDate;
    var params;
    var rows;

    if (!deviceId) {
      throw new Error("Debe seleccionar un vehiculo.");
    }

    if (!diagnosticId) {
      throw new Error("Debe seleccionar un diagnostico.");
    }

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

    params = {
      typeName: "StatusData",
      search: {
        deviceSearch: {
          id: deviceId
        },
        diagnosticSearch: {
          id: diagnosticId
        },
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString()
      },
      resultsLimit: 5000,
      sort: {
        sortBy: "dateTime",
        sortDirection: "desc"
      }
    };

    console.log("[Panel Combustible] Consultando StatusData con parametros:", params);

    rows = await apiCall("Get", params);

    console.log("[Panel Combustible] Registros StatusData:", Array.isArray(rows) ? rows.length : 0);
    console.table((Array.isArray(rows) ? rows : []).slice(0, 20));

    return Array.isArray(rows) ? rows : [];
  }

  function appendCell(row, value) {
    var cell = document.createElement("td");
    cell.textContent = value === undefined || value === null || value === "" ? "-" : String(value);
    row.appendChild(cell);
  }

  function renderRows(rows) {
    var tbody = getElement("resultBody");
    var selectedDevice = getSelectedDevice();
    var selectedDiagnostic = getSelectedDiagnostic();
    var selectedDeviceName = selectedDevice ? getDeviceLabel(selectedDevice) : "";
    var selectedDiagnosticName = selectedDiagnostic ? selectedDiagnostic.name || selectedDiagnostic.id : "";
    var unit = getDiagnosticUnitName(selectedDiagnostic);

    if (!tbody) {
      console.error("[Panel Combustible] No existe resultBody");
      return;
    }

    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 7;
      emptyCell.className = "empty-cell";
      emptyCell.textContent = "No se encontraron datos para los filtros seleccionados.";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    rows.forEach(function (rowData) {
      var row = document.createElement("tr");

      appendCell(row, selectedDeviceName);
      appendCell(row, rowData.dateTime ? new Date(rowData.dateTime).toLocaleString() : "");
      appendCell(row, selectedDiagnosticName);
      appendCell(row, rowData.data !== undefined && rowData.data !== null ? rowData.data : rowData.value);
      appendCell(row, unit);
      appendCell(row, selectedDevice ? selectedDevice.id : "");
      appendCell(row, selectedDiagnostic ? selectedDiagnostic.id : "");
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
      setStatusMessage("Registros encontrados: " + rows.length + ".");
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
    var deviceSelect = getElement("deviceSelect");
    var diagnosticSelect = getElement("diagnosticSelect");
    var fromDate = getElement("fromDate");
    var toDate = getElement("toDate");

    clearError();
    setLoading(false);
    setQueryButtonDisabled(false);

    if (deviceSelect) {
      deviceSelect.value = "";
    }

    if (diagnosticSelect) {
      diagnosticSelect.value = "";
    }

    if (fromDate) {
      fromDate.value = "";
    }

    if (toDate) {
      toDate.value = "";
    }

    setDefaultDates();
    setEmptyRows("Sin resultados para mostrar.");
    setStatusMessage("Filtros limpiados.");
  }

  function bindEvents() {
    var queryButton = getElement("queryButton");
    var clearButton = getElement("clearButton");

    if (eventsConfigured) {
      return;
    }

    if (queryButton) {
      queryButton.addEventListener("click", handleQueryClick);
    }

    if (clearButton) {
      clearButton.addEventListener("click", clearForm);
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
    ensureSdkAvailable();
  });
}());
