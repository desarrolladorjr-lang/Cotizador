// Motor de cálculo del cotizador. Función pura: sin React, sin DOM, sin estado.
// Se carga como global en el navegador y con require() en las pruebas.
(function (root) {
  const KG_POR_CARGA = { terrestre: 19500, nacional: 24500, inventario: 24500 };

  const TASA_RIESGO_ANUAL = 0.15;
  const MARGEN_EXTRA = 0.10;
  const KG_CARGA_FLETE_NAC = 24500;

  const truncar = n => Math.trunc(n * 100) / 100;

  // Ayuda de captura de Nacional: el operador piensa en precio por tonelada,
  // pero calcularCotizacion espera el total del embarque completo (todas las
  // cargas). Vive aquí, no en la JSX, para que sea una función pura y testable.
  function precioTotalNacionalDesdeTon(precioTonMxn, cargasTotales) {
    if (precioTonMxn === '' || precioTonMxn === null || precioTonMxn === undefined) return '';
    const cargas = Number(cargasTotales) || 1;
    const total = Number(precioTonMxn) * cargas * (KG_POR_CARGA.nacional / 1000);
    return total.toFixed(2);
  }

  function calcularCotizacion(e) {
    const num = v => Number(v) || 0;

    const modalidad = e.modalidad;
    if (modalidad === '') {
      throw new Error('calcularCotizacion: modalidad vacía — la captura está incompleta, no hay leaf que calcular.');
    }
    const tieneVenta = modalidad !== 'inventario';

    const numTcHoy = num(e.tcHoy);
    const numMerma = num(e.merma);
    const numManiobras = num(e.maniobras);
    const numPpProv = num(e.ppProv);
    const numFleteNac = num(e.fleteNac);

    // Se calcula también en nacional aunque el ingreso no lo use: viaja en el payload.
    const precioVenta = tieneVenta
      ? Number((((num(e.porcentajeFijacion) / 100) * num(e.fixPrice)) / 1000).toFixed(5))
      : 0;

    if (!tieneVenta) {
      return {
        tcSeguro: 0,
        capKg: KG_POR_CARGA.inventario,
        precioVenta: 0,
        precioTopeCompra: 0,
        utilidadNeta: 0,
        utilidadPorKg: 0,
        status: '',
      };
    }

    let tcSeguro, capKg, ingresoKgMxn, logKg;

    if (modalidad === 'nacional') {
      tcSeguro = 0;
      capKg = KG_POR_CARGA.nacional;
      logKg = numFleteNac / KG_CARGA_FLETE_NAC;
      const cargas = num(e.cargasTotales) || 1;
      ingresoKgMxn = num(e.precioTotalMxn) / (cargas * KG_POR_CARGA.nacional);
    } else {
      const colchon = ((numTcHoy * TASA_RIESGO_ANUAL / 365) * num(e.diasCobro)) + MARGEN_EXTRA;
      tcSeguro = numTcHoy - colchon;
      capKg = modalidad === 'maritimo'
        ? num(e.capacidadCNT) * 1000
        : KG_POR_CARGA.terrestre;
      const costoLogNacKg = numFleteNac / KG_CARGA_FLETE_NAC;
      const costoLogIntKg = (num(e.aduanaMex) + ((num(e.cruceInt) + num(e.aduanaUsa)) * tcSeguro)) / capKg;
      logKg = costoLogNacKg + costoLogIntKg;
      ingresoKgMxn = precioVenta * tcSeguro;
    }

    const precioTopeCompra = (ingresoKgMxn - logKg - numManiobras) * (1 - (numMerma / 100));
    const costoCompraMaterial = truncar((numPpProv / (1 - (numMerma / 100))) + numManiobras);
    const utilidadPorKg = truncar(ingresoKgMxn - costoCompraMaterial - logKg);

    let status;
    if (numPpProv > precioTopeCompra) status = 'bad';
    else if (numPpProv > precioTopeCompra - 0.5) status = 'warning';
    else status = 'good';

    return {
      tcSeguro,
      capKg,
      precioVenta,
      precioTopeCompra,
      utilidadNeta: utilidadPorKg * capKg,
      utilidadPorKg,
      status,
    };
  }

  const api = { KG_POR_CARGA, calcularCotizacion, precioTotalNacionalDesdeTon };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
