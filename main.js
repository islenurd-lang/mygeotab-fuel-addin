(function () {
  "use strict";

  var root = window.geotab = window.geotab || {};
  root.addin = root.addin || {};

  var apiRef = null;
  var stateRef = null;
  var eventsConfigured = false;

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var element = getElement(id);

    if (element) {
      element.textContent = text;
    }
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

  function toDateTimeLocalValue(date) {
    var offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  function setLoading(isLoading) {
    var loadingMessage = getElement("loadingMessage");
    var queryButton = getElement("queryButton");

    if (loadingMessage) {
      loadingMessage.hidden = !isLoading;
    }

    if (queryButton) {
      queryButton.disabled = isLoading;
      queryButton.textContent = isLoading ? "Consultando..." : "Consultar";
    }
  }

  function showError(message) {
    var errorMessage = getElement("errorMessage");

    if (errorMessage) {
      errorMessage.textContent = message || "No se pudo completar la operación.";
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

  function setEmptyRows(message) {
    var resultBody = getElement("resultBody");
    var row;
    var cell;

    if (!resultBody) {
      return;
    }

    resultBody.innerHTML = "";
    row = document.createElement("tr");
    cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "empty-cell";
    cell.textContent = message || "Sin resultados para mostrar.";
    row.appendChild(cell);
    resultBody.appendChild(row);
  }

  function appendCell(row, value) {
    var cell = document.createElement("td");
    cell.textContent = value || "-";
    row.appendChild(cell);
  }

  function renderRows(rows) {
    var resultBody = getElement("resultBody");

    if (!resultBody) {
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      setEmptyRows("No hay datos para mostrar.");
      return;
    }

    resultBody.innerHTML = "";
    rows.forEach(function (rowData) {
      var row = document.createElement("tr");
      appendCell(row, rowData.vehicle);
      appendCell(row, rowData.dateTime);
      appendCell(row, rowData.diagnostic);
      appendCell(row, rowData.value);
      appendCell(row, rowData.unit);
      appendCell(row, rowData.deviceId);
      appendCell(row, rowData.diagnosticId);
      resultBody.appendChild(row);
    });
  }

  function ensureSdkAvailable() {
    if (!apiRef || typeof apiRef.call !== "function") {
      setText("sdkStatus", "SDK no disponible");
      setText("infoMessage", "Este Add-In debe abrirse dentro de MyGeotab para usar el SDK.");
      return false;
    }

    setText("sdkStatus", "SDK disponible");
    setText("infoMessage", "SDK disponible. Selecciona filtros y consulta los datos.");
    return true;
  }

  function loadDevices() {
    if (!ensureSdkAvailable()) {
      return;
    }

    console.log("[Panel Combustible] loadDevices pendiente de completar");
  }

  function loadFuelDiagnostics() {
    if (!ensureSdkAvailable()) {
      return;
    }

    console.log("[Panel Combustible] loadFuelDiagnostics pendiente de completar");
  }

  function queryFuelStatusData() {
    clearError();

    if (!ensureSdkAvailable()) {
      showError("Abre este Add-In dentro de MyGeotab para consultar datos.");
      return;
    }

    setLoading(true);
    console.log("[Panel Combustible] queryFuelStatusData pendiente de completar");
    setLoading(false);
    setEmptyRows("La consulta de StatusData se implementará en la siguiente iteración.");
  }

  function clearForm() {
    var deviceSelect = getElement("deviceSelect");
    var diagnosticSelect = getElement("diagnosticSelect");

    clearError();
    setLoading(false);

    if (deviceSelect) {
      deviceSelect.value = "";
    }

    if (diagnosticSelect) {
      diagnosticSelect.value = "";
    }

    setDefaultDates();
    setEmptyRows("Sin resultados para mostrar.");
  }

  function configureEvents() {
    var queryButton = getElement("queryButton");
    var clearButton = getElement("clearButton");

    if (eventsConfigured) {
      return;
    }

    if (queryButton) {
      queryButton.addEventListener("click", queryFuelStatusData);
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
        apiRef = api || null;
        stateRef = state || null;

        configureEvents();
        setDefaultDates();
        ensureSdkAvailable();

        if (typeof callback === "function") {
          callback();
        }
      },

      focus: function (api, state) {
        console.log("[Panel Combustible] focus ejecutado");
        apiRef = api || apiRef;
        stateRef = state || stateRef;

        configureEvents();
        setDefaultDates();
        ensureSdkAvailable();
        loadDevices();
        loadFuelDiagnostics();
      },

      blur: function () {
        console.log("[Panel Combustible] blur ejecutado");
      }
    };
  };

  document.addEventListener("DOMContentLoaded", function () {
    configureEvents();
    setDefaultDates();
    ensureSdkAvailable();
  });
}());
