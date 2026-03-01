import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from "react";
import {
	disconnectFromDevice,
	removeDevice,
	trustDevice,
	connectToDevice,
	fetchDevices,
	BluetoothState,
	DeviceOptions,
	Bluetoothctl,
	Device,
} from "@/bluetoothctl";
import {
	showErrorToast
} from "@/defaultComponents";
import { BLUETOOTH_REGEX } from "./patterns";

type BluetoothContextState = {
	devices: Device[];
	loading: boolean;
	bluetoothState: BluetoothState | null;
	setDevices: (d: Device[]) => void;
	refreshDevices: () => Promise<void>;
	connect: (d: Device) => Promise<void>;
	disconnect: (d: Device) => Promise<void>;
	trust: (d: Device) => Promise<void>;
	forget: (d: Device) => Promise<void>;
	setBluetoothState: (s: BluetoothState | null) => void;
	removeFromDeviceList: (mac: string) => Promise<void>;
	addToDeviceList: (device: Device) => Promise<void>;
};

const BluetoothContext = createContext<BluetoothContextState | null>(null);

function isMacLike(name: string): boolean {
	return BLUETOOTH_REGEX.macAddress.test(name);
}

export function BluetoothProvider({ children }: { children: ReactNode }) {
	const [devices, setDevices] = useState<Device[]>([]);
	const [loading, setLoading] = useState(true);
	const [bluetoothState, setBluetoothState] = useState<BluetoothState | null>(null);
	const initedRef = useRef(false);

	const refreshDevices = useCallback(async () => {
		setLoading(true);
		try {
			setBluetoothState(await Bluetoothctl.getControllerInfo());
			const list = await fetchDevices(DeviceOptions.PAIRED);
			setDevicesSorted(list);
		} catch (error) {
			await showErrorToast("Failed to refresh devices", error);
		} finally {
			setLoading(false);
		}
	}, []);

	const sortDeviceList = useCallback((devices: Device[]) => {
		return devices.sort((a, b) => {
			const aIsMacOnly = isMacLike(a.name) || a.name === a.mac;
			const bIsMacOnly = isMacLike(b.name) || b.name === b.mac;

			return aIsMacOnly === bIsMacOnly
				? a.name.localeCompare(b.name)
				: aIsMacOnly
					? 1
					: -1;
		});
	}, []);

	useEffect(() => {
		if (initedRef.current) return;
		initedRef.current = true;
		void refreshDevices();
	}, [refreshDevices]);

	const setDevicesSorted = useCallback(
		(list: Device[] | ((prev: Device[]) => Device[])) => {
			setDevices(prev => {
				const newList = typeof list === "function" ? list(prev) : list;
				return sortDeviceList([...newList]);
			});
		},
		[sortDeviceList]
	);

	const removeFromDeviceList = useCallback(async (mac: string) => {
		setDevices(prev => sortDeviceList(prev.filter(d => d.mac !== mac)));
	}, [sortDeviceList]);

	const addToDeviceList = useCallback(async (device: Device) => {
		setDevices(prev => sortDeviceList([...prev, device]));
	}, [sortDeviceList]);

	const connect = useCallback(async (device: Device) => {
		setLoading(true);
		try {
			await connectToDevice(device)
				.then(refreshDevices);
		} catch (error) {
			await showErrorToast("Failed to connect to device", error);
		} finally {
			setLoading(false);
		}
	}, [refreshDevices]);

	const disconnect = useCallback(async (device: Device) => {
		setLoading(true);
		try {
			await disconnectFromDevice(device)
				.then(refreshDevices);
		} catch (error) {
			await showErrorToast("Failed to disconnect from device", error);
		} finally {
			setLoading(false);
		}
	}, [refreshDevices]);

	const trust = useCallback(async (device: Device) => {
		setLoading(true);
		try {
			await trustDevice(device)
				.then(refreshDevices);
		} catch (error) {
			await showErrorToast("Failed to trust device", error);
		} finally {
			setLoading(false);
		}
	}, [refreshDevices]);

	const forget = useCallback(async (device: Device) => {
		setLoading(true);
		try {
			await removeDevice(device)
				.then(refreshDevices);
		} catch (error) {
			await showErrorToast("Failed to forget device", error);
		} finally {
			setLoading(false);
		}
	}, [refreshDevices]);

	const contextValue = useMemo(
		() => ({
			devices,
			loading,
			bluetoothState,
			refreshDevices,
			setDevices: setDevicesSorted,
			connect,
			disconnect,
			trust,
			forget,
			setBluetoothState,
			removeFromDeviceList,
			addToDeviceList
		}),
		[
			devices,
			loading,
			bluetoothState,
			refreshDevices,
			setDevices,
			connect,
			disconnect,
			trust,
			forget,
			removeFromDeviceList,
			addToDeviceList
		]
	);

	return (
		<BluetoothContext.Provider value={contextValue} >
			{children}
		</BluetoothContext.Provider>
	);
}

export function useBluetooth() {
	const ctx = useContext(BluetoothContext);
	if (!ctx) throw new Error("useBluetooth must be used within a BluetoothProvider");
	return ctx;
}
