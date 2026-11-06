import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Wallet,
  ShoppingBag,
  Plus,
  Trash2,
  Lock,
  LogOut,
  Banknote,
  Mail,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronDown,
  ArrowRightLeft,
  Search,
  Calendar,
  User,
  Armchair,
  Trees,
  Paintbrush,
  Wrench,
  Zap,
  Users,
  HelpCircle,
  Receipt,
  Code,
  FileSpreadsheet,
  FileText,
  BadgeCheck,
  ListFilter
} from 'lucide-react';

const LogoTaller = ({ size = 64, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Control de caja">
    <rect x="8" y="8" width="84" height="84" rx="20" fill="#b45309" />
    <rect x="25" y="30" width="50" height="44" rx="6" stroke="white" strokeWidth="4" />
    <path d="M25 43h50M38 56h24M38 64h14" stroke="white" strokeWidth="4" strokeLinecap="round" />
  </svg>
);
const formatCLP = (value) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(value || 0);

const etiquetaPeriodo = (p) => ({
  semana: 'Esta Semana',
  mes: 'Este Mes',
  mes_anterior: 'Mes Anterior',
  anio: 'Año Actual',
  todo: 'Todo el Historial'
}[p] || p);

const calcularRangoPeriodo = (periodo) => {
  const ahora = new Date();

  if (periodo === 'semana') {
    const diaSemana = ahora.getDay();
    const difLunes = ahora.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), difLunes, 0, 0, 0, 0);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 23, 59, 59, 999);
    return { inicio, fin };
  }
  if (periodo === 'mes') {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    return { inicio, fin };
  }
  if (periodo === 'mes_anterior') {
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1, 0, 0, 0, 0);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59, 999);
    return { inicio, fin };
  }
  if (periodo === 'anio') {
    const inicio = new Date(ahora.getFullYear(), 0, 1, 0, 0, 0, 0);
    const fin = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { inicio, fin };
  }
  return { inicio: null, fin: null };
};

// --- RUT chileno: limpiar, formatear y validar (dígito verificador módulo 11) ---
const limpiarRut = (rut) => rut.replace(/[^0-9kK]/g, '').toUpperCase();

const formatearRut = (rut) => {
  const limpio = limpiarRut(rut);
  if (limpio.length <= 1) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFormateado}-${dv}`;
};

const validarRut = (rut) => {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dvIngresado = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  let dvEsperado;
  if (resto === 11) dvEsperado = '0';
  else if (resto === 10) dvEsperado = 'K';
  else dvEsperado = String(resto);

  return dvEsperado === dvIngresado;
};

const iconosCategorias = {
  'Todas las categorías': ListFilter,
  'Venta Mesas y Sillas (Juego)': Armchair,
  'Mesas': Armchair,
  'Sillas': Armchair,
  'Otro Ingreso': Banknote,
  'Abono Pedido': Receipt,
  'Madera / Materiales': Trees,
  'Cola / Barniz / Insumos': Paintbrush,
  'Herramientas': Wrench,
  'Servicios / Luz': Zap,
  'Sueldos / Retiros': Users,
  'Otro Egreso': HelpCircle
};

const iconosMetodosPago = {
  'Efectivo': Banknote,
  'Transferencia': ArrowRightLeft
};

const CategoryIcon = ({ categoria, className = "w-4 h-4" }) => {
  const IconComponent = iconosCategorias[categoria] || HelpCircle;
  return <IconComponent className={className} />;
};

const PaymentIcon = ({ metodo, className = "w-4 h-4" }) => {
  const IconComponent = iconosMetodosPago[metodo] || Banknote;
  return <IconComponent className={className} />;
};

function CategorySelect({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white flex items-center justify-between focus:outline-none focus:border-amber-500 shadow-sm"
      >
        <div className="flex items-center gap-2.5 truncate">
          <CategoryIcon categoria={value} className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <span className="truncate text-slate-800">{value}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
          {options.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                onChange(cat);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-amber-50 hover:text-amber-900 transition-colors ${
                value === cat ? 'bg-amber-100/60 font-semibold text-amber-900' : 'text-slate-700'
              }`}
            >
              <CategoryIcon categoria={cat} className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <span className="truncate">{cat}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentSelect({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white flex items-center justify-between focus:outline-none focus:border-amber-500 shadow-sm"
      >
        <div className="flex items-center gap-2.5 truncate">
          <PaymentIcon metodo={value} className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <span className="truncate text-slate-800">{value}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
          {options.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onChange(m);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-amber-50 hover:text-amber-900 transition-colors ${
                value === m ? 'bg-amber-100/60 font-semibold text-amber-900' : 'text-slate-700'
              }`}
            >
              <PaymentIcon metodo={m} className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <span className="truncate">{m}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const auth = getAuth();

  const [currentUser, setCurrentUser] = useState(null);

  const readRememberedEmail = () => {
    try {
      return sessionStorage.getItem('rememberedEmail') || '';
    } catch {
      return '';
    }
  };

  const [loginStep, setLoginStep] = useState(() => (readRememberedEmail() ? 2 : 1));
  const [emailInput, setEmailInput] = useState(() => readRememberedEmail());
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('movimientos');

  const [filtroPeriodo, setFiltroPeriodo] = useState('semana');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas las categorías');
  const [busqueda, setBusqueda] = useState('');

  const [movimientos, setMovimientos] = useState([]);
  const [pedidos, setPedidos] = useState([]);

  const [dataError, setDataError] = useState('');

  const [itemAEliminar, setItemAEliminar] = useState(null);
  const [pedidoParaAbonar, setPedidoParaAbonar] = useState(null);
  const [montoAbonoInput, setMontoAbonoInput] = useState('');
  const [metodoAbonoInput, setMetodoAbonoInput] = useState('Efectivo');
  const [abonoError, setAbonoError] = useState('');
  const [guardandoAbono, setGuardandoAbono] = useState(false);

  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    tipo: 'ingreso',
    monto: '',
    comprador: '',
    compradorRut: '',
    trabajador: '',
    concepto: '',
    categoria: 'Venta Mesas y Sillas (Juego)',
    metodoPago: 'Efectivo'
  });
  const [movimientoError, setMovimientoError] = useState('');
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);
  const [compradorEncontrado, setCompradorEncontrado] = useState('');

  const [nuevoPedido, setNuevoPedido] = useState({
    cliente: '',
    clienteRut: '',
    descripcion: '',
    total: '',
    abono: '',
    telefono: '',
    metodoPago: 'Efectivo'
  });
  const [pedidoError, setPedidoError] = useState('');
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState('');

  const categoriasIngreso = ['Venta Mesas y Sillas (Juego)', 'Mesas', 'Sillas', 'Otro Ingreso'];
  const categoriasEgreso = ['Madera / Materiales', 'Cola / Barniz / Insumos', 'Herramientas', 'Servicios / Luz', 'Sueldos / Retiros', 'Otro Egreso'];
  const metodosPago = ['Efectivo', 'Transferencia'];
  // Incluye "Abono Pedido" porque esa categoría se asigna sola a los
  // movimientos de abono y no aparece en los selects del formulario.
  const categoriasParaFiltro = ['Todas las categorías', ...categoriasIngreso, ...categoriasEgreso, 'Abono Pedido'];

  const esCategoriaConComprador = ['Venta Mesas y Sillas (Juego)', 'Mesas', 'Sillas'].includes(nuevoMovimiento.categoria);
  const esCategoriaSueldo = nuevoMovimiento.tipo === 'egreso' && nuevoMovimiento.categoria === 'Sueldos / Retiros';

  useEffect(() => {
    setPersistence(auth, browserSessionPersistence).catch((err) => {
      console.error('Error al configurar la persistencia:', err);
    });
  }, [auth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!currentUser) return;
    setDataError('');

    const onListenerError = (label) => (err) => {
      console.error(`Error al escuchar ${label}:`, err);
      setDataError('No se pudieron cargar algunos datos. Revisa tu conexión a internet o vuelve a iniciar sesión.');
    };

    const qMovs = query(collection(db, 'movimientos'), orderBy('fecha', 'desc'));
    const unsubMovs = onSnapshot(qMovs, (snap) => {
      setMovimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onListenerError('movimientos'));

    const qPed = query(collection(db, 'pedidos'), orderBy('fecha', 'desc'));
    const unsubPed = onSnapshot(qPed, (snap) => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onListenerError('pedidos'));

    return () => {
      unsubMovs();
      unsubPed();
    };
  }, [currentUser]);

  const handleNextStep = (e) => {
    e.preventDefault();
    setAuthError('');
    if (emailInput.trim() !== '') setLoginStep(2);
  };

  const handleCambiarCorreo = () => {
    try { sessionStorage.removeItem('rememberedEmail'); } catch {}
    setLoginStep(1);
    setEmailInput('');
    setPasswordInput('');
    setAuthError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    const emailAUsar = emailInput.trim();
    try {
      await signInWithEmailAndPassword(auth, emailAUsar, passwordInput);
      try { sessionStorage.setItem('rememberedEmail', emailAUsar); } catch {}
      setPasswordInput('');
    } catch (err) {
      console.error("Error de autenticación:", err);
      setAuthError('Contraseña o correo incorrectos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthError('');
      const remembered = readRememberedEmail();
      if (remembered) {
        setEmailInput(remembered);
        setLoginStep(2);
      } else {
        setEmailInput('');
        setLoginStep(1);
      }
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  // Al escribir el RUT de un comprador, si ya existe un movimiento previo
  // con ese mismo RUT, se rellena el nombre automáticamente y se avisa —
  // así no queda "Juan Pérez" y "Juan Perez" como si fueran dos personas.
  const handleCompradorRutChange = (valor) => {
    const formateado = formatearRut(valor);
    setNuevoMovimiento((prev) => ({ ...prev, compradorRut: formateado }));

    const limpio = limpiarRut(formateado);
    if (limpio.length >= 8) {
      const existente = movimientos.find((m) => m.compradorRut && limpiarRut(m.compradorRut) === limpio && m.comprador);
      if (existente) {
        setCompradorEncontrado(existente.comprador);
        setNuevoMovimiento((prev) => ({ ...prev, compradorRut: formateado, comprador: prev.comprador || existente.comprador }));
      } else {
        setCompradorEncontrado('');
      }
    } else {
      setCompradorEncontrado('');
    }
  };

  const handleClienteRutChange = (valor) => {
    const formateado = formatearRut(valor);
    setNuevoPedido((prev) => ({ ...prev, clienteRut: formateado }));

    const limpio = limpiarRut(formateado);
    if (limpio.length >= 8) {
      const existente = pedidos.find((p) => p.clienteRut && limpiarRut(p.clienteRut) === limpio && p.cliente);
      if (existente) {
        setClienteEncontrado(existente.cliente);
        setNuevoPedido((prev) => ({
          ...prev,
          clienteRut: formateado,
          cliente: prev.cliente || existente.cliente,
          telefono: prev.telefono || existente.telefono || ''
        }));
      } else {
        setClienteEncontrado('');
      }
    } else {
      setClienteEncontrado('');
    }
  };

  const handleAddMovimiento = async (e) => {
    e.preventDefault();
    if (guardandoMovimiento) return;

    setMovimientoError('');
    const monto = parseFloat(nuevoMovimiento.monto);
    const concepto = nuevoMovimiento.concepto.trim();
    const comprador = nuevoMovimiento.comprador.trim();
    const compradorRut = nuevoMovimiento.compradorRut.trim();
    const trabajador = nuevoMovimiento.trabajador.trim();

    if (!monto || monto <= 0) return setMovimientoError('Ingresa un monto válido.');
    if (nuevoMovimiento.tipo === 'ingreso' && esCategoriaConComprador) {
      if (!comprador) return setMovimientoError('Por favor ingresa el nombre del comprador.');
      if (!compradorRut) return setMovimientoError('Por favor ingresa el RUT del comprador.');
      if (!validarRut(compradorRut)) return setMovimientoError('El RUT del comprador no es válido. Revisa el dígito verificador.');
    }
    if (esCategoriaSueldo && !trabajador) {
      return setMovimientoError('Por favor ingresa el nombre del trabajador.');
    }
    if (!concepto) return setMovimientoError('Ingresa una descripción.');

    setGuardandoMovimiento(true);
    try {
      await addDoc(collection(db, 'movimientos'), {
        tipo: nuevoMovimiento.tipo,
        monto,
        comprador: nuevoMovimiento.tipo === 'ingreso' && esCategoriaConComprador ? comprador : '',
        compradorRut: nuevoMovimiento.tipo === 'ingreso' && esCategoriaConComprador ? limpiarRut(compradorRut) : '',
        trabajador: esCategoriaSueldo ? trabajador : '',
        concepto,
        categoria: nuevoMovimiento.categoria,
        metodoPago: nuevoMovimiento.metodoPago,
        fecha: new Date().toISOString()
      });
      setNuevoMovimiento({
        tipo: nuevoMovimiento.tipo,
        monto: '',
        comprador: '',
        compradorRut: '',
        trabajador: '',
        concepto: '',
        categoria: nuevoMovimiento.tipo === 'ingreso' ? 'Venta Mesas y Sillas (Juego)' : 'Sueldos / Retiros',
        metodoPago: 'Efectivo'
      });
      setCompradorEncontrado('');
    } catch (err) {
      console.error("Error al agregar movimiento:", err);
      setMovimientoError('No se pudo guardar el movimiento.');
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  const ejecutarEliminacion = async () => {
    if (!itemAEliminar) return;

    try {
      if (itemAEliminar.tipo === 'movimiento') {
        await deleteDoc(doc(db, 'movimientos', itemAEliminar.id));
      } else if (itemAEliminar.tipo === 'pedido') {
        const pedidoId = itemAEliminar.id;

        const qMovsAsociados = query(
          collection(db, 'movimientos'),
          where('pedidoId', '==', pedidoId)
        );
        const movsSnap = await getDocs(qMovsAsociados);

        const batch = writeBatch(db);
        movsSnap.docs.forEach((mDoc) => batch.delete(doc(db, 'movimientos', mDoc.id)));
        batch.delete(doc(db, 'pedidos', pedidoId));
        await batch.commit();
      }
    } catch (err) {
      console.error("Error al eliminar registro:", err);
      alert('No se pudo eliminar el registro. Intenta nuevamente.');
    } finally {
      setItemAEliminar(null);
    }
  };

  const handleAddPedido = async (e) => {
    e.preventDefault();
    if (guardandoPedido) return;

    setPedidoError('');
    const cliente = nuevoPedido.cliente.trim();
    const clienteRut = nuevoPedido.clienteRut.trim();
    const total = parseFloat(nuevoPedido.total);
    const abono = parseFloat(nuevoPedido.abono) || 0;

    if (!cliente) return setPedidoError('Ingresa el nombre del cliente.');
    if (clienteRut && !validarRut(clienteRut)) return setPedidoError('El RUT del cliente no es válido. Revisa el dígito verificador.');
    if (!total || total <= 0) return setPedidoError('Ingresa un total válido.');
    if (abono < 0 || abono > total) return setPedidoError('Revisa el monto abonado.');

    const saldo = total - abono;

    setGuardandoPedido(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(collection(db, 'pedidos'));

      batch.set(pedidoRef, {
        cliente,
        clienteRut: clienteRut ? limpiarRut(clienteRut) : '',
        descripcion: nuevoPedido.descripcion.trim(),
        total,
        abono,
        saldo: saldo > 0 ? saldo : 0,
        telefono: nuevoPedido.telefono.trim(),
        metodoPago: nuevoPedido.metodoPago,
        estado: saldo <= 0 ? 'Entregado' : 'Pendiente',
        fecha: new Date().toISOString()
      });

      if (abono > 0) {
        const movimientoRef = doc(collection(db, 'movimientos'));
        batch.set(movimientoRef, {
          tipo: 'ingreso',
          monto: abono,
          comprador: cliente,
          compradorRut: clienteRut ? limpiarRut(clienteRut) : '',
          concepto: `Abono inicial pedido - ${cliente}`,
          categoria: 'Abono Pedido',
          metodoPago: nuevoPedido.metodoPago,
          pedidoId: pedidoRef.id,
          fecha: new Date().toISOString()
        });
      }

      await batch.commit();
      setNuevoPedido({ cliente: '', clienteRut: '', descripcion: '', total: '', abono: '', telefono: '', metodoPago: 'Efectivo' });
      setClienteEncontrado('');
    } catch (err) {
      console.error("Error al crear pedido:", err);
      setPedidoError('No se pudo guardar el pedido.');
    } finally {
      setGuardandoPedido(false);
    }
  };

  const handleCambiarEstadoPedido = async (id, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pedidos', id), { estado: nuevoEstado });
    } catch (err) {
      console.error("Error al actualizar estado del pedido:", err);
      alert('No se pudo actualizar el estado del pedido.');
    }
  };

  const handleConfirmarAbono = async (e) => {
    e.preventDefault();
    if (guardandoAbono) return;

    setAbonoError('');
    if (!pedidoParaAbonar) return;

    const abonoNum = parseFloat(montoAbonoInput);
    if (isNaN(abonoNum) || abonoNum <= 0) return setAbonoError('Ingresa un monto válido.');

    setGuardandoAbono(true);
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoParaAbonar.id);
      const movimientoRef = doc(collection(db, 'movimientos'));

      await runTransaction(db, async (transaction) => {
        const pedidoSnap = await transaction.get(pedidoRef);
        if (!pedidoSnap.exists()) {
          throw new Error('Este pedido ya no existe (puede que otra persona lo haya eliminado).');
        }

        const pedidoActual = pedidoSnap.data();
        const saldoServidor = pedidoActual.saldo ?? (pedidoActual.total - (pedidoActual.abono || 0));

        if (abonoNum > saldoServidor) {
          throw new Error(`El abono no puede superar el saldo pendiente (${formatCLP(saldoServidor)}).`);
        }

        const nuevoAbono = (pedidoActual.abono || 0) + abonoNum;
        const nuevoSaldo = pedidoActual.total - nuevoAbono;
        const nuevoEstado = nuevoSaldo <= 0 ? 'Entregado' : pedidoActual.estado;

        transaction.update(pedidoRef, {
          abono: nuevoAbono,
          saldo: nuevoSaldo > 0 ? nuevoSaldo : 0,
          estado: nuevoEstado
        });

        transaction.set(movimientoRef, {
          tipo: 'ingreso',
          monto: abonoNum,
          comprador: pedidoActual.cliente,
          compradorRut: pedidoActual.clienteRut || '',
          concepto: `Abono a pedido - ${pedidoActual.cliente}`,
          categoria: 'Abono Pedido',
          metodoPago: metodoAbonoInput,
          pedidoId: pedidoParaAbonar.id,
          fecha: new Date().toISOString()
        });
      });

      setPedidoParaAbonar(null);
      setMontoAbonoInput('');
    } catch (err) {
      console.error("Error al registrar abono:", err);
      setAbonoError(err.message && !err.code ? err.message : 'No se pudo registrar el abono.');
    } finally {
      setGuardandoAbono(false);
    }
  };

  const { inicio: inicioPeriodo, fin: finPeriodo } = calcularRangoPeriodo(filtroPeriodo);

  const movimientosPorPeriodo = movimientos.filter((m) => {
    if (filtroPeriodo === 'todo') return true;
    if (!m.fecha) return false;
    const fechaMov = new Date(m.fecha);
    if (inicioPeriodo && fechaMov < inicioPeriodo) return false;
    if (finPeriodo && fechaMov > finPeriodo) return false;
    return true;
  });

  const movimientosFiltrados = movimientosPorPeriodo.filter((m) => {
    if (filtroCategoria !== 'Todas las categorías' && m.categoria !== filtroCategoria) return false;
    if (busqueda.trim()) {
      const b = busqueda.toLowerCase();
      const conceptoMatch = m.concepto ? m.concepto.toLowerCase().includes(b) : false;
      const compradorMatch = m.comprador ? m.comprador.toLowerCase().includes(b) : false;
      const rutMatch = m.compradorRut ? limpiarRut(m.compradorRut).toLowerCase().includes(limpiarRut(b).toLowerCase()) : false;
      const trabajadorMatch = m.trabajador ? m.trabajador.toLowerCase().includes(b) : false;
      const categoriaMatch = m.categoria ? m.categoria.toLowerCase().includes(b) : false;
      const metodoMatch = m.metodoPago ? m.metodoPago.toLowerCase().includes(b) : false;

      return conceptoMatch || compradorMatch || rutMatch || trabajadorMatch || categoriaMatch || metodoMatch;
    }
    return true;
  });

  const totalIngresos = movimientosPorPeriodo.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = movimientosPorPeriodo.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
  const balanceNeto = totalIngresos - totalEgresos;

  const efectivoEnManoReal = movimientos
    .filter(m => m.metodoPago === 'Efectivo')
    .reduce((acc, m) => acc + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);

  const exportarExcel = () => {
    if (movimientosFiltrados.length === 0) {
      alert('No hay movimientos para exportar en este período.');
      return;
    }
    const datos = movimientosFiltrados.map((m) => ({
      Fecha: new Date(m.fecha).toLocaleString('es-CL'),
      Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
      Categoría: m.categoria,
      'Comprador / Trabajador': m.comprador || m.trabajador || '',
      RUT: m.compradorRut ? formatearRut(m.compradorRut) : '',
      Concepto: m.concepto,
      'Método de Pago': m.metodoPago,
      Monto: m.monto
    }));

    const hoja = XLSX.utils.json_to_sheet(datos);
    hoja['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 12 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `ControlCaja_movimientos_${filtroPeriodo}_${fechaArchivo}.xlsx`);
  };

  const exportarPDF = () => {
    if (movimientosFiltrados.length === 0) {
      alert('No hay movimientos para exportar en este período.');
      return;
    }

    const documento = new jsPDF();

    documento.setFontSize(14);
    documento.setTextColor(30, 41, 59);
    documento.text('Control de Caja - Historial de Movimientos', 14, 15);

    documento.setFontSize(10);
    documento.setTextColor(100, 116, 139);
    documento.text(`Período: ${etiquetaPeriodo(filtroPeriodo)}`, 14, 22);
    if (busqueda.trim()) {
      documento.text(`Filtro de búsqueda: "${busqueda.trim()}"`, 14, 27);
    }

    documento.setFontSize(10);
    documento.setTextColor(15, 23, 42);
    documento.text(
      `Ingresos: ${formatCLP(totalIngresos)}   |   Egresos: ${formatCLP(totalEgresos)}   |   Balance: ${formatCLP(balanceNeto)}`,
      14,
      busqueda.trim() ? 34 : 29
    );

    autoTable(documento, {
      startY: busqueda.trim() ? 40 : 35,
      head: [['Fecha', 'Tipo', 'Categoría', 'Involucrado', 'RUT', 'Concepto', 'Pago', 'Monto']],
      body: movimientosFiltrados.map((m) => [
        new Date(m.fecha).toLocaleDateString('es-CL'),
        m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
        m.categoria,
        m.comprador || m.trabajador || '-',
        m.compradorRut ? formatearRut(m.compradorRut) : '-',
        m.concepto,
        m.metodoPago,
        formatCLP(m.monto)
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [217, 119, 6], textColor: 255 },
      columnStyles: { 7: { halign: 'right' } }
    });

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    documento.save(`ControlCaja_movimientos_${filtroPeriodo}_${fechaArchivo}.pdf`);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400 font-medium">Cargando aplicación...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between items-center p-4">
        <div className="w-full"></div>
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-slate-700 my-auto">
          <div className="flex justify-center mb-2">
            <LogoTaller size={110} />
          </div>
          <h1 className="text-2xl font-bold text-center mb-1 text-white">Control de Caja</h1>
          <p className="text-amber-400 font-medium text-center mb-6 text-xs uppercase tracking-wider">Gestión Contable de Ventas</p>

          {loginStep === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Correo Electrónico</label>
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoFocus
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="usuario@example.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-amber-500 text-sm"
                  />
                  <Mail size={18} className="absolute left-3 top-3.5 text-slate-500" />
                </div>
              </div>

              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 rounded-lg transition-colors shadow-lg flex items-center justify-center space-x-2">
                <span>Continuar</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {loginStep === 2 && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-300 text-sm truncate">
                  <Mail size={16} className="text-amber-500 flex-shrink-0" />
                  <span className="truncate">{emailInput}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCambiarCorreo}
                  className="text-xs text-amber-400 hover:underline flex items-center space-x-1 flex-shrink-0 ml-2"
                >
                  <ArrowLeft size={12} />
                  <span>Cambiar</span>
                </button>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider mb-1 text-slate-400">Contraseña</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-amber-500 text-sm"
                  />
                  <Lock size={18} className="absolute left-3 top-3.5 text-slate-500" />
                </div>
              </div>

              {authError && <p className="text-red-400 text-sm text-center font-medium">{authError}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg transition-colors shadow-lg"
              >
                {isSubmitting ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
              </button>
            </form>
          )}
        </div>

        <footer className="py-4 text-center text-xs text-slate-500 flex items-center justify-center space-x-1">
          <Code size={14} className="text-amber-500/70" />
          <span>Control de caja para talleres</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col justify-between">
      <div>
        <header className="bg-slate-900 text-white px-6 py-3 flex flex-wrap justify-between items-center shadow-md">
          <div className="flex items-center space-x-3 mb-2 md:mb-0">
            <LogoTaller size={46} />
            <div>
              <h1 className="text-lg font-bold leading-none text-white">Control de Caja</h1>
              <span className="text-[11px] text-amber-400 font-medium">Registro Continuo de Ingresos y Egresos</span>
            </div>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-lg space-x-1">
            <button onClick={() => setActiveTab('movimientos')} className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm ${activeTab === 'movimientos' ? 'bg-amber-500 text-slate-900' : 'text-slate-300'}`}>
              <Wallet size={18} />
              <span>Libro de Movimientos</span>
            </button>
            <button onClick={() => setActiveTab('pedidos')} className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm ${activeTab === 'pedidos' ? 'bg-amber-500 text-slate-900' : 'text-slate-300'}`}>
              <ShoppingBag size={18} />
              <span>Pedidos y Clientes</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 mt-2 md:mt-0">
            <span className="text-xs text-slate-400 hidden sm:inline">{currentUser.email}</span>
            <button onClick={handleLogout} className="flex items-center space-x-1 text-slate-400 hover:text-red-400 text-sm transition-colors">
              <LogOut size={16} />
              <span>Salir</span>
            </button>
          </div>
        </header>

        {dataError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-700 text-sm px-4 py-2 text-center">
            {dataError}
          </div>
        )}

        <main className="max-w-7xl mx-auto p-4 md:p-6">
          {activeTab === 'movimientos' && (
            <div className="space-y-6">
              {/* BARRA DE FILTROS */}
              <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-slate-600 text-sm font-semibold">
                  <Calendar size={18} className="text-amber-500" />
                  <span>Período de Consulta:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFiltroPeriodo('semana')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filtroPeriodo === 'semana' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Esta Semana
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('mes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filtroPeriodo === 'mes' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Este Mes
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('mes_anterior')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filtroPeriodo === 'mes_anterior' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Mes Anterior
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('anio')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filtroPeriodo === 'anio' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Año Actual
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('todo')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filtroPeriodo === 'todo' ? 'bg-amber-500 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Todo el Historial
                  </button>
                </div>
              </div>

              {/* TARJETAS RESUMEN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingresos del Período</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCLP(totalIngresos)}</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Egresos del Período</p>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{formatCLP(totalEgresos)}</p>
                </div>

                <div className="bg-amber-50/80 p-4 rounded-xl shadow-sm border border-amber-300">
                  <p className="text-xs font-bold text-amber-900 flex items-center space-x-1 uppercase tracking-wider">
                    <Banknote size={15} className="text-amber-700" />
                    <span>Total efectivo</span>
                  </p>
                  <p className="text-2xl font-bold text-amber-800 mt-1">{formatCLP(efectivoEnManoReal)}</p>
                  <span className="text-[10px] text-amber-700">Saldo acumulado disponible</span>
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-sm flex flex-col justify-center">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Balance del Período</p>
                  <p className={`text-2xl font-bold mt-1 ${balanceNeto >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {formatCLP(balanceNeto)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* FORMULARIO DE REGISTRO */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold mb-4 flex items-center space-x-2">
                    <Plus size={20} className="text-amber-500" />
                    <span>Añadir Registro</span>
                  </h2>
                  <form onSubmit={handleAddMovimiento} className="space-y-3">
                    <div>
                      <span className="block text-sm font-medium mb-1">Tipo de Operación</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNuevoMovimiento({ ...nuevoMovimiento, tipo: 'ingreso', categoria: 'Venta Mesas y Sillas (Juego)' })}
                          className={`py-2 text-sm font-bold rounded-lg border ${nuevoMovimiento.tipo === 'ingreso' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white text-slate-600'}`}
                        >
                          + Ingreso
                        </button>
                        <button
                          type="button"
                          onClick={() => setNuevoMovimiento({ ...nuevoMovimiento, tipo: 'egreso', categoria: 'Sueldos / Retiros' })}
                          className={`py-2 text-sm font-bold rounded-lg border ${nuevoMovimiento.tipo === 'egreso' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white text-slate-600'}`}
                        >
                          - Egreso
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Categoría</label>
                      <CategorySelect
                        value={nuevoMovimiento.categoria}
                        onChange={(cat) => setNuevoMovimiento({ ...nuevoMovimiento, categoria: cat })}
                        options={nuevoMovimiento.tipo === 'ingreso' ? categoriasIngreso : categoriasEgreso}
                      />
                    </div>

                    {nuevoMovimiento.tipo === 'ingreso' && esCategoriaConComprador && (
                      <>
                        <div>
                          <label htmlFor="mov-comprador-rut" className="block text-sm font-medium mb-1 text-amber-900">
                            RUT del Comprador *
                          </label>
                          <input
                            id="mov-comprador-rut"
                            type="text"
                            required
                            value={nuevoMovimiento.compradorRut}
                            onChange={(e) => handleCompradorRutChange(e.target.value)}
                            placeholder="Ej: 12.345.678-9"
                            maxLength={12}
                            className="w-full border border-amber-300 bg-amber-50/40 rounded-lg px-3 py-2 text-sm focus:border-amber-500"
                          />
                          {compradorEncontrado && (
                            <p className="text-xs text-emerald-700 flex items-center gap-1 mt-1">
                              <BadgeCheck size={13} />
                              <span>Cliente existente: {compradorEncontrado}</span>
                            </p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="mov-comprador" className="block text-sm font-medium mb-1 text-amber-900">
                            Nombre del Comprador *
                          </label>
                          <input
                            id="mov-comprador"
                            type="text"
                            required
                            value={nuevoMovimiento.comprador}
                            onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, comprador: e.target.value })}
                            placeholder="Ej: Carlos Muñoz"
                            className="w-full border border-amber-300 bg-amber-50/40 rounded-lg px-3 py-2 text-sm focus:border-amber-500"
                          />
                        </div>
                      </>
                    )}

                    {esCategoriaSueldo && (
                      <div>
                        <label htmlFor="mov-trabajador" className="block text-sm font-medium mb-1 text-rose-900">
                          Nombre del Trabajador *
                        </label>
                        <input
                          id="mov-trabajador"
                          type="text"
                          required
                          value={nuevoMovimiento.trabajador}
                          onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, trabajador: e.target.value })}
                          placeholder="Ej: Juan Pérez"
                          className="w-full border border-rose-300 bg-rose-50/40 rounded-lg px-3 py-2 text-sm focus:border-rose-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1">Método de Pago</label>
                      <PaymentSelect
                        value={nuevoMovimiento.metodoPago}
                        onChange={(m) => setNuevoMovimiento({ ...nuevoMovimiento, metodoPago: m })}
                        options={metodosPago}
                      />
                    </div>

                    <div>
                      <label htmlFor="mov-monto" className="block text-sm font-medium mb-1">Monto ($)</label>
                      <input
                        id="mov-monto"
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={nuevoMovimiento.monto}
                        onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, monto: e.target.value })}
                        placeholder="Ej: 150000"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="mov-concepto" className="block text-sm font-medium mb-1">Descripción / Detalle</label>
                      <input
                        id="mov-concepto"
                        type="text"
                        required
                        value={nuevoMovimiento.concepto}
                        onChange={(e) => setNuevoMovimiento({ ...nuevoMovimiento, concepto: e.target.value })}
                        placeholder="Ej: Pago semanal viernes o Comedor 6 sillas"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>

                    {movimientoError && <p className="text-rose-600 text-xs font-medium">{movimientoError}</p>}

                    <button
                      type="submit"
                      disabled={guardandoMovimiento}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
                    >
                      {guardandoMovimiento ? 'Guardando...' : 'Guardar Movimiento'}
                    </button>
                  </form>
                </div>

                {/* TABLA DE MOVIMIENTOS CON SCROLL INTERNO */}
                <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <h2 className="text-lg font-bold text-slate-900">Historial de Movimientos</h2>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="w-40 flex-shrink-0">
                        <CategorySelect
                          value={filtroCategoria}
                          onChange={setFiltroCategoria}
                          options={categoriasParaFiltro}
                        />
                      </div>
                      <div className="relative flex-1 sm:w-56">
                        <input
                          type="text"
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar cliente, RUT, trabajador..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                        />
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      </div>
                      <button
                        type="button"
                        onClick={exportarExcel}
                        title="Exportar a Excel"
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        <FileSpreadsheet size={14} />
                        <span className="hidden sm:inline">Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={exportarPDF}
                        title="Exportar a PDF"
                        className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        <FileText size={14} />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                    </div>
                  </div>

                  {movimientosFiltrados.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No hay registros cargados para el período seleccionado.</p>
                  ) : (
                    <div className="max-h-[500px] overflow-y-auto border border-slate-100 rounded-lg">
                      <table className="w-full text-left text-sm relative">
                        <thead className="sticky top-0 bg-slate-100 text-slate-600 font-semibold text-xs border-b border-slate-200 z-10">
                          <tr>
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Detalle / Concepto</th>
                            <th className="py-2.5 px-3">Categoría / Pago</th>
                            <th className="py-2.5 px-3 text-right">Monto</th>
                            <th className="py-2.5 px-3 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {movimientosFiltrados.map((m) => (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                                {new Date(m.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                <span className="block text-[10px] text-slate-400">{new Date(m.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                              </td>
                              <td className="py-3 px-3">
                                <p className="font-medium text-slate-800">{m.concepto}</p>
                                {m.comprador && (
                                  <p className="text-xs text-amber-800 font-semibold flex items-center gap-1 mt-0.5">
                                    <User size={12} className="text-amber-600" />
                                    <span>{m.comprador}{m.compradorRut ? ` · ${formatearRut(m.compradorRut)}` : ''}</span>
                                  </p>
                                )}
                                {m.trabajador && (
                                  <p className="text-xs text-rose-800 font-semibold flex items-center gap-1 mt-0.5">
                                    <User size={12} className="text-rose-600" />
                                    <span>Trabajador: {m.trabajador}</span>
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex flex-wrap gap-1">
                                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                                    <CategoryIcon categoria={m.categoria} className="w-3.5 h-3.5" />
                                    <span>{m.categoria}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-xs">
                                    <PaymentIcon metodo={m.metodoPago} className="w-3 h-3 text-amber-700" />
                                    <span>{m.metodoPago}</span>
                                  </span>
                                </div>
                              </td>
                              <td className={`py-3 px-3 text-right font-bold whitespace-nowrap ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {m.tipo === 'ingreso' ? '+' : '-'}{formatCLP(m.monto)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => setItemAEliminar({ id: m.id, tipo: 'movimiento' })}
                                  className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                                  aria-label="Eliminar movimiento"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA PEDIDOS */}
          {activeTab === 'pedidos' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold mb-4 flex items-center space-x-2">
                    <ShoppingBag size={20} className="text-amber-500" />
                    <span>Nuevo Pedido</span>
                  </h2>
                  <form onSubmit={handleAddPedido} className="space-y-3">
                    <div>
                      <label htmlFor="ped-cliente-rut" className="block text-sm font-medium mb-1">RUT Cliente (Opcional)</label>
                      <input
                        id="ped-cliente-rut"
                        type="text"
                        value={nuevoPedido.clienteRut}
                        onChange={(e) => handleClienteRutChange(e.target.value)}
                        placeholder="Ej: 12.345.678-9"
                        maxLength={12}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                      {clienteEncontrado && (
                        <p className="text-xs text-emerald-700 flex items-center gap-1 mt-1">
                          <BadgeCheck size={13} />
                          <span>Cliente existente: {clienteEncontrado}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="ped-cliente" className="block text-sm font-medium mb-1">Nombre Cliente</label>
                      <input
                        id="ped-cliente"
                        type="text"
                        required
                        value={nuevoPedido.cliente}
                        onChange={(e) => setNuevoPedido({ ...nuevoPedido, cliente: e.target.value })}
                        placeholder="Juan Pérez"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="ped-telefono" className="block text-sm font-medium mb-1">Teléfono (Opcional)</label>
                      <input
                        id="ped-telefono"
                        type="text"
                        value={nuevoPedido.telefono}
                        onChange={(e) => setNuevoPedido({ ...nuevoPedido, telefono: e.target.value })}
                        placeholder="+56 9..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="ped-descripcion" className="block text-sm font-medium mb-1">Descripción</label>
                      <textarea
                        id="ped-descripcion"
                        required
                        value={nuevoPedido.descripcion}
                        onChange={(e) => setNuevoPedido({ ...nuevoPedido, descripcion: e.target.value })}
                        placeholder="Ej: Juego de comedor 6 sillas Roble"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="ped-total" className="block text-sm font-medium mb-1">Total ($)</label>
                        <input
                          id="ped-total"
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={nuevoPedido.total}
                          onChange={(e) => setNuevoPedido({ ...nuevoPedido, total: e.target.value })}
                          placeholder="250000"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="ped-abono" className="block text-sm font-medium mb-1">Abono Inicial ($)</label>
                        <input
                          id="ped-abono"
                          type="number"
                          min="0"
                          step="1"
                          value={nuevoPedido.abono}
                          onChange={(e) => setNuevoPedido({ ...nuevoPedido, abono: e.target.value })}
                          placeholder="100000"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Método de Pago (Abono)</label>
                      <PaymentSelect
                        value={nuevoPedido.metodoPago}
                        onChange={(m) => setNuevoPedido({ ...nuevoPedido, metodoPago: m })}
                        options={metodosPago}
                      />
                    </div>

                    {pedidoError && <p className="text-rose-600 text-xs font-medium">{pedidoError}</p>}

                    <button
                      type="submit"
                      disabled={guardandoPedido}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-sm mt-2 transition-colors"
                    >
                      {guardandoPedido ? 'Guardando...' : 'Guardar Pedido'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-lg font-bold">Lista de Pedidos</h2>
                  {pedidos.length === 0 ? (
                    <div className="bg-white p-8 text-center text-slate-400 rounded-xl border border-slate-200">
                      No hay pedidos registrados en el sistema.
                    </div>
                  ) : (
                    <div className="max-h-[600px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pedidos.map((p) => {
                          const esEntregado = p.estado === 'Entregado';
                          const colorEstado = esEntregado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';

                          return (
                            <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h3 className="font-bold text-slate-900">{p.cliente}</h3>
                                    {p.clienteRut && <p className="text-xs text-slate-500">{formatearRut(p.clienteRut)}</p>}
                                    {p.telefono && <p className="text-xs text-slate-400">{p.telefono}</p>}
                                  </div>
                                  <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold ${colorEstado}`}>
                                    {p.estado || 'Pendiente'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded">{p.descripcion}</p>

                                <div className="text-xs space-y-1 mb-4">
                                  <div className="flex justify-between text-slate-500">
                                    <span>Total:</span>
                                    <span className="font-medium text-slate-700">{formatCLP(p.total)}</span>
                                  </div>
                                  <div className="flex justify-between text-emerald-600 font-medium">
                                    <span>Abonado:</span>
                                    <span>{formatCLP(p.abono)}</span>
                                  </div>
                                  <div className="flex justify-between text-rose-600 font-bold border-t pt-1">
                                    <span>Saldo Pendiente:</span>
                                    <span>{formatCLP(p.saldo)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                                {p.saldo > 0 && (
                                  <button
                                    onClick={() => { setPedidoParaAbonar(p); setMontoAbonoInput(''); setAbonoError(''); }}
                                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-1.5 rounded text-xs transition-colors"
                                  >
                                    + Registrar Abono
                                  </button>
                                )}
                                <select
                                  value={p.estado || 'Pendiente'}
                                  onChange={(e) => handleCambiarEstadoPedido(p.id, e.target.value)}
                                  aria-label={`Estado del pedido de ${p.cliente}`}
                                  className="text-xs border rounded py-1.5 px-2 bg-white font-medium"
                                >
                                  <option value="Pendiente">Pendiente</option>
                                  <option value="Entregado">Entregado</option>
                                </select>
                                <button
                                  onClick={() => setItemAEliminar({ id: p.id, tipo: 'pedido' })}
                                  className="text-slate-400 hover:text-rose-500 p-1"
                                  aria-label="Eliminar pedido"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="py-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-1.5 border-t border-slate-200/60 mt-8 bg-white/50">
        <Code size={14} className="text-amber-600" />
        <span>Control de caja para talleres</span>
      </footer>

      {/* MODAL DE ELIMINACIÓN */}
      {itemAEliminar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">
              {itemAEliminar.tipo === 'pedido' ? '¿Borrar o Cancelar Pedido?' : '¿Eliminar registro?'}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              {itemAEliminar.tipo === 'pedido'
                ? 'Al borrar este pedido, también se eliminarán automáticamente de la caja todos los abonos cobrados a este cliente.'
                : 'Esta acción eliminará de forma permanente el registro del sistema.'}
            </p>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setItemAEliminar(null)}
                className="w-1/2 border border-slate-300 hover:bg-slate-50 font-semibold py-2 rounded-lg text-xs text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarEliminacion}
                className="w-1/2 bg-rose-600 hover:bg-rose-700 font-bold text-white py-2 rounded-lg text-xs shadow"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA ABONOS */}
      {pedidoParaAbonar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-900">Abonar a Pedido</h3>
              <button onClick={() => setPedidoParaAbonar(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-1">Cliente: <strong className="text-slate-800">{pedidoParaAbonar.cliente}</strong></p>
            <p className="text-xs text-slate-500 mb-4">Saldo Restante: <strong className="text-rose-600">{formatCLP(pedidoParaAbonar.saldo)}</strong></p>

            <form onSubmit={handleConfirmarAbono} className="space-y-4">
              <div>
                <label htmlFor="abono-monto" className="block text-sm font-medium mb-1">Monto del Abono ($)</label>
                <input
                  id="abono-monto"
                  type="number"
                  min="1"
                  step="1"
                  required
                  autoFocus
                  max={pedidoParaAbonar.saldo}
                  value={montoAbonoInput}
                  onChange={(e) => setMontoAbonoInput(e.target.value)}
                  placeholder="Ej: 50000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Método de Pago</label>
                <PaymentSelect
                  value={metodoAbonoInput}
                  onChange={(m) => setMetodoAbonoInput(m)}
                  options={metodosPago}
                />
              </div>

              {abonoError && <p className="text-rose-600 text-xs font-medium">{abonoError}</p>}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPedidoParaAbonar(null)}
                  className="w-1/2 border border-slate-300 hover:bg-slate-50 font-semibold py-2 rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoAbono}
                  className="w-1/2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-400 disabled:cursor-not-allowed font-bold text-slate-900 py-2 rounded-lg text-xs shadow"
                >
                  {guardandoAbono ? 'Guardando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}