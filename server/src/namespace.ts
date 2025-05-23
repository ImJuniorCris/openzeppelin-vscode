import { keccak256 } from 'ethereumjs-util';
import { Range } from 'vscode-languageserver-textdocument';

export type Namespace = {
	contractName: string;
	prefix?: string;
	variables?: Variable[];
}

export type Variable = {
	content: string;
	name: string;
	range: Range;
	publicGetter?: PublicGetter;
}

export type PublicGetter = {
	typeName: string;
}

export function getNamespaceId(namespacePrefix: string | undefined, contractName: string) {
	return `${namespacePrefix ? namespacePrefix + '.' : ''}${contractName}`;
}

/**
 * Prints the reference ERC7201 template for a given namespace
 */
export function printNamespaceTemplate(namespace: Namespace, indent = "    ") {
	const namespaceId = getNamespaceId(namespace.prefix, namespace.contractName);
	const structName = toStorageStructName(namespace.contractName);
	const locationName = `${structName}Location`;
	const rootLocation = calculateERC7201StorageLocation(namespaceId);

	const publicGetters = `${namespace.variables?.map(variable => variable.publicGetter ? printPublicGetter(variable.name, variable.publicGetter.typeName, structName) : undefined).join(`\n${indent}`)}`;

	const namespaceStructContent = `\
/// @custom:storage-location erc7201:${namespaceId}
${indent}struct ${structName} {
${namespace.variables?.map(variable => `${indent}${indent}${variable.content}`).join(`\n`)}
${indent}}

${indent}// keccak256(abi.encode(uint256(keccak256("${namespaceId}")) - 1)) & ~bytes32(uint256(0xff))
${indent}bytes32 private constant ${locationName} = ${rootLocation};

${indent}function _get${structName}() private pure returns (${structName} storage $) {
${indent}${indent}assembly {
${indent}${indent}${indent}$.slot := ${locationName}
${indent}${indent}}
${indent}}
${publicGetters}
`;

	return namespaceStructContent;
}

export function toStorageStructName(contractName: string) {
	return `${contractName}Storage`;
}

export function printPublicGetter(name: string, typeName: string, storageStructName: string, indent = "    ") {
	return `\
function ${name}() public view returns (${typeName}) {
${indent}${indent}${storageStructName} storage $ = _get${storageStructName}();
${indent}${indent}return $.${name};
${indent}}
`;
};

/**
 * Returns the ERC7201 storage location hash for a given namespace id
 */
export function calculateERC7201StorageLocation(id: string): string {
	const firstHash = keccak256(Buffer.from(id));
	const minusOne = BigInt('0x' + firstHash.toString('hex')) - 1n;
	const minusOneBuffer = Buffer.from(minusOne.toString(16), 'hex');

	const secondHash = keccak256(minusOneBuffer);
	
	const mask = BigInt('0xff');
	const masked = BigInt('0x' + secondHash.toString('hex')) & ~mask;

	const padded = masked.toString(16).padStart(64, '0');

	return '0x' + padded;
}
