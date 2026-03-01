// Original code provided by user
import {
	useEffect,
	useState,
	useCallback,
	useRef
} from "react";
import {
	ActionPanel,
	List,
	Icon,
	Color,
} from "@vicinae/api";
import {
	Bluetoothctl,
	BluetoothctlLine,
	BluetoothState,
	PairingContext,
	LineType,
	Device,
} from "@/bluetoothctl";
import {
	BluetoothPoweredOffView,
	TogglePowerAction,
	ScanAction,
	DevicesAction,
	showErrorToast
} from "./defaultComponents";

function useDiscover() {
	const [pairingDevice, setPairingDevice] = useState<Device | null>(null);
	const btRef = useRef<Bluetoothctl | null>(null);

	const pairingDeviceRef = useRef<Device | null>(null);
	pairingDeviceRef.current = pairingDevice;

	const handleDiscoveryLine = useCallback(async (line: BluetoothctlLine) => {
		try {
			if (line.type === LineType.DeviceNew) {
				const device = await btRef.current?.handleNewDevice(line);
				if (device) setPairingDevice(device);
			} else if (line.type === LineType.DeviceChanged) {
				const updated = await Bluetoothctl.getDeviceInfo(line.device.mac);
				setPairingDevice(updated);
			} else if (line.type === LineType.PasskeyConfirmation) {
				await btRef.current?.handlePasskeyConfirmation(
					line,
					pairingDeviceRef.current,
					PairingContext.IncomingPairing
				);
				setPairingDevice(null);
			} else if (line.type === LineType.RequestCancelled) {
				setPairingDevice(null);
			} else if (line.type === LineType.PinCodeRequest) {
				console.error("Pin code request not implemented");
				await btRef.current?.handlePinCodeRequest(
					line,
					pairingDeviceRef.current,
					PairingContext.IncomingPairing
				);
				setPairingDevice(null);
			} else if (line.type === LineType.PairingSuccess) {
				btRef.current?.handlePairingSuccess(line);
				setPairingDevice(null);
			} else if (line.type === LineType.PairingFailure) {
				btRef.current?.handlePairingFailure(line);
				setPairingDevice(null);
			}
		} catch (err) {
			console.error("Pairing line error:", err);
			showErrorToast("Failed to handle pairing event", err);
		}
	}, []);

	useEffect(() => {
		const bt = new Bluetoothctl();
		btRef.current = bt;

		bt.onLine(handleDiscoveryLine);

		return () => {
			bt.kill();
		};
	}, [handleDiscoveryLine]);

	return { pairingDevice, setPairingDevice };
}

function useDiscoverMonitor() {
	const [bluetoothState, setBluetoothState] = useState<BluetoothState | null>(null);
	const [loading, setLoading] = useState(false);

	const makeDiscoverable = useCallback(async () => {
		setLoading(true);
		try {
			await Bluetoothctl.setDiscoverable("on");
			setBluetoothState(await Bluetoothctl.getControllerInfo());
		} catch (err) {
			console.error("Discoverability error:", err);
			showErrorToast("Failed to make device discoverable", err);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		let cancelled = false;

		const init = async () => {
			try {
				const info = await Bluetoothctl.getControllerInfo();
				if (!cancelled) setBluetoothState(info);
			} catch (err) {
				console.error("Failed to get Bluetooth status:", err);
				showErrorToast("Failed to get Bluetooth status", err);
			}

			if (!cancelled) await makeDiscoverable();
		};

		init();

		return () => {
			console.info("Cancelling discoverability");
			cancelled = true;
			Bluetoothctl.setDiscoverable("off");
		};
	}, [makeDiscoverable]);

	return {
		bluetoothState,
		setBluetoothState,
		loading,
		makeDiscoverable,
	};
}

export default function Discover() {
	const {
		bluetoothState,
		setBluetoothState,
		loading,
	} = useDiscoverMonitor();

	const {
		pairingDevice,
	} = useDiscover();

	const title = (() => {
		if (loading) return "Setting up Discoverability";
		if (pairingDevice) return `Pairing with ${pairingDevice.name}`;
		if (bluetoothState?.discoverable) return `Device is ${bluetoothState.name}`;
		return "Device is Discoverable";
	})();

	const description = (() => {
		let text = "Your device is visible to other Bluetooth devices while this command is open.\n\n";
		if (pairingDevice) text += `Currently pairing with: ${pairingDevice.name}\n\n`;
		return text;
	})();

	if (!bluetoothState?.powered) {
		return <BluetoothPoweredOffView setBluetoothState={setBluetoothState} />;
	}

	console.log('Starting discoverability');

	return (
		<List
			isLoading={loading}
			actions={
				<ActionPanel>
					<ActionPanel.Section title="Navigation">
						<ScanAction />
						<DevicesAction />
						<TogglePowerAction
							bluetoothState={bluetoothState}
							setBluetoothState={setBluetoothState}
						/>
					</ActionPanel.Section>
				</ActionPanel>
			}
		>
			<List.EmptyView
				icon={{
					source: pairingDevice ? Icon.Link : Icon.Eye,
					tintColor: pairingDevice ? Color.Blue : Color.Green,
				}}
				title={title}
				description={description}
			/>
		</List>
	);
}
