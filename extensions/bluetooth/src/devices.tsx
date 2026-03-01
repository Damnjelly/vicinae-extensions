import React, {
	useState,
	useContext,
	createContext,
	useCallback,
	useMemo,
	ReactNode
} from "react";
import {
	Action,
	ActionPanel,
	Color,
	Icon,
	List,
	getPreferenceValues,
} from "@vicinae/api";
import {
	Device,
} from "@/bluetoothctl";
import {
	ScanAction,
	DiscoverAction,
	TogglePowerAction
} from "./defaultComponents";
import { BluetoothProvider, useBluetooth } from "@/model";

interface Preferences {
	connectionToggleable: boolean;
}

type DetailsState = {
	details: boolean;
	toggleDetails: () => void;
};

const DetailsContext = createContext<DetailsState | null>(null);

function DetailsProvider({ children }: { children: ReactNode }) {
	const [details, setDetails] = useState(true);

	const contextValue = useMemo(
		() => ({
			details, toggleDetails: () => setDetails((s) => !s)
		}),
		[details]
	);

	return (
		<DetailsContext.Provider value={contextValue} >
			{children}
		</DetailsContext.Provider>
	);
}

function useDetails() {
	const ctx = useContext(DetailsContext);
	if (!ctx) throw new Error("useDetails must be used within a DetailsProvider");
	return ctx;
}

export default function AppDevices() {
	return (
		<DetailsProvider>
			<BluetoothProvider>
				<Devices />
			</BluetoothProvider>
		</DetailsProvider>
	);
}

function Devices() {
	const { devices, loading } = useBluetooth();
	const { details } = useDetails();

	return (
		<List
			isLoading={loading}
			searchBarPlaceholder="Search paired devices..."
			isShowingDetail={details}>
			<BluetoothController />
			<List.Section title="Known Devices">
				{devices.map((device) => (
					<DeviceListItem
						key={device.mac}
						device={device} />
				))}
			</List.Section>
		</List>
	);
}

const BluetoothController = React.memo(function BluetoothController() {
	const {
		bluetoothState,
		refreshDevices,
		setBluetoothState
	} = useBluetooth();
	const { details, toggleDetails } = useDetails();

	const poweredAccessory = useMemo(
		() =>
			bluetoothState?.powered
				? { text: { value: "Powered", color: Color.Green }, icon: Icon.Checkmark }
				: { text: { value: "Not Powered", color: Color.Orange }, icon: Icon.XMarkCircle },
		[bluetoothState?.powered]
	);

	return (
		<List.Item
			title="Bluetooth Info"
			accessories={!details ? [poweredAccessory] : undefined}
			detail={
				<List.Item.Detail
					metadata={
						<List.Item.Detail.Metadata>
							<List.Item.Detail.Metadata.Label
								title="Name"
								text={bluetoothState?.name || "Unknown"}
								icon={{ source: Icon.Bluetooth, tintColor: Color.Blue }} />
							<List.Item.Detail.Metadata.Separator />
							<List.Item.Detail.Metadata.Label
								title="Powered"
								text={bluetoothState?.powered ? "Yes" : "No"}
								icon={{
									source: bluetoothState?.powered
										? Icon.Checkmark
										: Icon.XMarkCircle,
									tintColor: bluetoothState?.powered
										? Color.Green
										: Color.Red
								}} />
							<List.Item.Detail.Metadata.Label
								title="Discoverable"
								text={bluetoothState?.discoverable ? "Yes" : "No"}
								icon={{
									source: bluetoothState?.discoverable
										? Icon.Checkmark
										: Icon.XMarkCircle,
									tintColor: bluetoothState?.discoverable
										? Color.Green
										: Color.Red
								}} />
							<List.Item.Detail.Metadata.Label
								title="Discovering"
								text={bluetoothState?.discovering ? "Yes" : "No"}
								icon={{
									source: bluetoothState?.discovering
										? Icon.Checkmark
										: Icon.XMarkCircle,
									tintColor: bluetoothState?.discovering
										? Color.Green
										: Color.Red
								}} />
							<List.Item.Detail.Metadata.Label
								title="Pairable"
								text={bluetoothState?.pairable ? "Yes" : "No"}
								icon={{
									source: bluetoothState?.pairable
										? Icon.Checkmark
										: Icon.XMarkCircle,
									tintColor: bluetoothState?.pairable
										? Color.Green
										: Color.Red
								}} />
						</List.Item.Detail.Metadata>
					}
				/>
			}
			actions={
				<ActionPanel>
					<Action
						title="Refresh Devices"
						icon={Icon.ArrowClockwise}
						shortcut={{ modifiers: ["cmd"], key: "r" }}
						onAction={refreshDevices} />
					<TogglePowerAction
						bluetoothState={bluetoothState}
						setBluetoothState={setBluetoothState} />
					<ActionPanel.Section>
						<Action
							title="Show Details"
							icon={Icon.Eye}
							onAction={toggleDetails}
							shortcut={{ modifiers: ["cmd"], key: "i" }} />
					</ActionPanel.Section>
					<ActionPanel.Section>
						<ScanAction />
						<DiscoverAction />
					</ActionPanel.Section>
				</ActionPanel>
			}
		/>
	);
});

function DeviceAccessoriesComponent({ device }: { device: Device }) {
	const trustAccessory = {
		text: device.trusted
			? { value: "Trusted", color: Color.Green }
			: { value: "Not Trusted", color: Color.Orange },
		icon: { source: Icon.Lock },
	};

	const connectionAccessory = {
		text: device.connected
			? { value: "Connected", color: Color.Green }
			: { value: "Disconnected", color: Color.Red },
		icon: device.connected ? Icon.Checkmark : Icon.XMarkCircle,
	};

	return [trustAccessory, connectionAccessory];
}

const DeviceActions = React.memo(function DeviceActions({ device }: { device: Device }) {
	const preferences = getPreferenceValues<Preferences>();
	const {
		refreshDevices,
		connect,
		disconnect,
		trust,
		forget,
	} = useBluetooth();
	const { toggleDetails } = useDetails();

	const onToggleConnection = useCallback(async () => {
		try {
			if (device.connected) await disconnect(device);
			else await connect(device);
		} catch (error) {
			console.error(`Failed to toggle connection for ${device.name}:`, error);
		} finally {
			await refreshDevices();
		}
	}, [device, connect, disconnect, refreshDevices]);

	return (
		<>
			{preferences.connectionToggleable ? (
				<Action
					title={device.connected ? "Disconnect" : "Connect"}
					icon={device.connected ? Icon.WifiDisabled : Icon.Wifi}
					style={device.connected ? ("destructive" as any) : undefined}
					shortcut={{ modifiers: ["cmd"], key: "c" }}
					onAction={onToggleConnection}
				/>
			) : (
				<>
					<Action
						title="Connect"
						icon={Icon.Wifi}
						shortcut={{ modifiers: ["cmd"], key: "c" }}
						onAction={() => connect(device)} />
					<Action
						title="Disconnect"
						icon={Icon.WifiDisabled}
						style={("destructive" as any)}
						shortcut={{ modifiers: ["cmd"], key: "d" }}
						onAction={() => disconnect(device)} />
				</>
			)}

			<Action
				title="Trust"
				icon={Icon.Heart}
				shortcut={{ modifiers: ["cmd"], key: "t" }}
				onAction={() => trust(device)} />
			<Action
				title="Forget"
				icon={Icon.HeartDisabled}
				style={("destructive" as any)}
				shortcut={{ modifiers: ["cmd"], key: "f" }}
				onAction={() => forget(device)} />

			<ActionPanel.Section>
				<Action
					title="Show Details"
					icon={Icon.Eye}
					onAction={toggleDetails}
					shortcut={{ modifiers: ["cmd"], key: "i" }} />
				<Action
					title="Refresh Devices"
					icon={Icon.ArrowClockwise}
					shortcut={{ modifiers: ["cmd"], key: "r" }}
					onAction={refreshDevices} />
			</ActionPanel.Section>
			<ActionPanel.Section>
				<ScanAction />
				<DiscoverAction />
			</ActionPanel.Section>
		</>
	);
});

const DeviceListItem = React.memo(function DeviceListItem({ device }: { device: Device }) {
	const { details } = useDetails();

	return (
		<List.Item
			title={device.name}
			subtitle={device.mac}
			icon={device.icon}
			accessories={!details ? DeviceAccessoriesComponent({ device }) : undefined}
			detail={details ? <DeviceDetail device={device} /> : undefined}
			actions={
				<ActionPanel>
					<DeviceActions device={device} />
				</ActionPanel>
			}
		/>
	);
});

function batteryIconColor(batteryLevel: number): Color {
	if (batteryLevel > 20) return Color.Green;
	else if (batteryLevel > 5) return Color.Orange;
	else return Color.Red
}

const DeviceDetail = React.memo(function DeviceDetail({ device }: { device: Device }) {
	return (
		<List.Item.Detail
			metadata={
				<List.Item.Detail.Metadata>
					<List.Item.Detail.Metadata.Label title="Device Name" text={device.name} />
					<List.Item.Detail.Metadata.Label title="MAC Address" text={device.mac} />
					<List.Item.Detail.Metadata.Separator />
					<List.Item.Detail.Metadata.Label
						title="Trust Status"
						text={device.trusted ? "Trusted" : "Not Trusted"}
						icon={{
							source: Icon.Lock,
							tintColor: device.trusted
								? Color.Green
								: Color.Orange
						}} />
					<List.Item.Detail.Metadata.Label
						title="Connection Status"
						text={device.connected ? "Connected" : "Disconnected"}
						icon={{
							source: device.connected
								? Icon.Checkmark
								: Icon.XMarkCircle,
							tintColor: device.connected
								? Color.Green
								: Color.Red
						}} />
					{device.connected && typeof device.batteryLevel === 'number' ? (
						<List.Item.Detail.Metadata.Label
							title='Battery Level'
							text={`${device.batteryLevel} %`}
							icon={
								{
									source: Icon.Battery,
									tintColor: batteryIconColor(device.batteryLevel)
								}
							}
						/>
					) : undefined}
				</List.Item.Detail.Metadata>
			}
		/>
	);
});
