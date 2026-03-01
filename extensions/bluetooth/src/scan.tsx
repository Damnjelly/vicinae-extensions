import { useEffect, useState, useCallback, useRef } from "react";
import {
	Action,
	ActionPanel,
	Icon,
	List,
} from "@vicinae/api";
import {
	pairToDevice,
	connectToDevice,
	Device,
	Bluetoothctl,
	BluetoothctlLine,
	LineType
} from "@/bluetoothctl";
import {
	BluetoothPoweredOffView,
	TogglePowerAction,
	showErrorToast
} from "./defaultComponents";
import { BluetoothProvider, useBluetooth } from "@/model";

function useScan() {
	const {
		devices,
		bluetoothState,
		setBluetoothState,
		removeFromDeviceList,
		addToDeviceList
	} = useBluetooth();

	const [loading, setLoading] = useState(false);
	const btRef = useRef<Bluetoothctl | null>(null);

	const handleScanningLine = useCallback(async (line: BluetoothctlLine) => {
		try {
			if (line.type === LineType.DeviceNew) {
				const device = await btRef.current?.handleNewDevice(line);
				if (device) await addToDeviceList(device);
			} else if (line.type === LineType.DeviceDeleted) {
				await removeFromDeviceList(line.device.mac);
			}
		} catch (err) {
			console.error("Pairing line error:", err);
			showErrorToast("Failed to handle pairing event", err);
		}
	}, []);

	const handlePairAndConnect = useCallback(async (device: Device) => {
		try {
			await pairToDevice(device)
				.then(() => connectToDevice(device))
				.then(() => removeFromDeviceList(device.mac));
		} catch (error) {
			console.error(`Failed to pair and connect to ${device.name}:`, error);
		}
	}, [removeFromDeviceList]);

	const handleConnect = useCallback(async (device: Device) => {
		try {
			await connectToDevice(device)
				.then(() => removeFromDeviceList(device.mac));
		} catch (error) {
			console.error(`Failed to connect to ${device.name}:`, error);
		}
	}, [removeFromDeviceList]);

	useEffect(() => {
		let cancelled = false;

		const init = async (bt: Bluetoothctl) => {
			setLoading(true);
			try {
				const info = await Bluetoothctl.getControllerInfo();
				setBluetoothState(info);
				if (!cancelled) setBluetoothState(info);
			} catch (err) {
				console.error("Failed to get Bluetooth status:", err);
				showErrorToast("Failed to get Bluetooth status", err);
			} finally {
				if (!cancelled) bt.scan("on");
			}
		};

		const bt = new Bluetoothctl();
		btRef.current = bt;

		init(bt);

		bt.onLine(handleScanningLine);

		return () => {
			console.log("stop scanning");
			setLoading(false);
			bt.scan("off");
			bt.kill();
			cancelled = true;
		};
	}, [handleScanningLine]);

	return {
		devices,
		loading,
		bluetoothState,
		setBluetoothState,
		removeFromDeviceList,
		handlePairAndConnect,
		handleConnect
	};
}

export default function AppDevices() {
	return (
		<BluetoothProvider>
			<Scan />
		</BluetoothProvider>
	);
}

function Scan() {
	const {
		bluetoothState,
		setBluetoothState,
		loading,
		devices,
		handlePairAndConnect,
		handleConnect
	} = useScan();


	if (!bluetoothState?.powered) {
		return <BluetoothPoweredOffView setBluetoothState={setBluetoothState} />;
	}

	return (
		<List isLoading={loading} searchBarPlaceholder="Scanning for Bluetooth devices...">
			{!loading && devices.length === 0 && (
				<List.EmptyView icon={Icon.Bluetooth} title="No devices found" />
			)}

			{devices.map((device) => (
				<List.Item
					key={device.mac}
					title={device.name}
					subtitle={device.mac}
					icon={device.icon}
					actions={
						<ActionPanel>
							<Action
								title="Pair"
								shortcut={{ modifiers: ["ctrl"], key: "p" }}
								onAction={() => handlePairAndConnect(device)}
							/>
							<Action
								title="Connect"
								shortcut={{ modifiers: ["ctrl"], key: "c" }}
								onAction={() => handleConnect(device)}
							/>
							{TogglePowerAction({ bluetoothState, setBluetoothState })}
						</ActionPanel>
					}
				/>
			))}
		</List>
	);
}
