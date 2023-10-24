import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Poseidon,
  Struct,
} from 'o1js';

// This class now represents a prescription.
export class Prescription extends Struct({
  patientIdHash: Field, // Hash of the patient's identity
  medicationName: Field, // Hashed name of the medication
  dosage: Field, // Hashed dosage information
  expiryDate: Field, // Expiry date of the prescription
}) {}

export class MedicationRequirements extends Struct({
  medicationName: Field,
  maxDosage: Field,
  minDosage: Field,
}) {}

function hashPrescription(prescription: Prescription) {
  return Poseidon.hash(Prescription.toFields(prescription));
}

export class zkPharmasMarket extends SmartContract {
  events = {
    verified: Field,
  };

  @state(Field) prescriptionHash = State<Field>();
  @state(Field) verifiedMedicationRequirementsHash = State<Field>();

  init() {
    super.init();
    this.prescriptionHash.set(Field(0));
    this.verifiedMedicationRequirementsHash.set(Field(0));
  }

  // Doctor issues a prescription.
  @method issuePrescription(prescription: Prescription) {
    this.prescriptionHash.set(hashPrescription(prescription));
  }

  // Patient uses this method to validate prescription for a drug purchase.
  @method validateDrugPurchase(
    prescription: Prescription,
    medicationToCheck: MedicationRequirements
  ) {
    const hash = hashPrescription(prescription);

    this.prescriptionHash.assertEquals(hash);
    prescription.medicationName.assertEquals(medicationToCheck.medicationName);
    prescription.dosage.assertGreaterThanOrEqual(medicationToCheck.minDosage);
    prescription.dosage.assertLessThanOrEqual(medicationToCheck.maxDosage);

    this.verifiedMedicationRequirementsHash.set(
      Poseidon.hash([
        new Field(medicationToCheck.medicationName),
        new Field(medicationToCheck.minDosage),
        new Field(medicationToCheck.maxDosage),
      ])
    );
  }

  // zkPharma's Market uses this method to verify the patient's prescription.
  @method verifyPrescriptionForPurchase(
    medicationToCheck: MedicationRequirements
  ) {
    const medicationHashToCheck = Poseidon.hash([
      new Field(medicationToCheck.medicationName),
      new Field(medicationToCheck.minDosage),
      new Field(medicationToCheck.maxDosage),
    ]);

    const currentMedicationRequirementsHash =
      this.verifiedMedicationRequirementsHash.get();

    console.log('incoming medication hash: ', medicationHashToCheck);
    console.log('current medication hash: ', currentMedicationRequirementsHash);

    currentMedicationRequirementsHash.assertGreaterThan(Field(0));
    this.verifiedMedicationRequirementsHash.assertEquals(medicationHashToCheck);

    this.emitEvent('verified', medicationHashToCheck);
  }
}
