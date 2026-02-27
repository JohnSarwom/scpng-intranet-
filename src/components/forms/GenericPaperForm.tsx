import React from 'react';
import { FormTemplate } from '@/types/forms';

export const GenericPaperForm: React.FC<{ template: FormTemplate }> = ({ template }) => {
    return (
        <div style={{ fontFamily: '\'Times New Roman\', Times, serif', width: '800px', margin: '20px auto', padding: '20px', fontSize: '14px', lineHeight: '1.2', border: '1px solid #ccc' }}>
            <style>
                {`
          .generic-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .generic-table td, .generic-table th { border: 1px solid #000; padding: 6px; vertical-align: top; }
          .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; }
          .header-text { text-align: center; margin: 0; padding: 0; }
          .form-input { width: 100%; border: none; background: transparent; border-bottom: 1px dotted #000; padding: 2px; outline: none; }
        `}
            </style>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                <img src="/images/SCPNG Original Logo.png" alt="SCPNG Logo" style={{ width: '120px', height: 'auto' }} />
                <h2 className="header-text" style={{ fontSize: '18px', fontWeight: 'bold', margin: '8px 0', textTransform: 'uppercase' }}>{template.title}</h2>
                <p className="header-text" style={{ fontSize: '12px', margin: '3px 0' }}>{template.description}</p>
            </div>

            {template.sections.map((section, idx) => (
                <div key={section.id}>
                    <div className="section-title">
                        {String.fromCharCode(65 + idx)}) {section.title}
                    </div>
                    {section.description && <p style={{ fontStyle: 'italic', marginBottom: '8px' }}>{section.description}</p>}

                    <table className="generic-table">
                        <tbody>
                            {section.fields.map((field) => (
                                <tr key={field.id}>
                                    <td style={{ width: '30%', fontWeight: 'bold' }}>{field.label}{field.required ? ' *' : ''}</td>
                                    <td style={{ width: '70%' }}>
                                        {field.type === 'textarea' ? (
                                            <div style={{ minHeight: '60px', borderBottom: '1px dotted #000', width: '100%' }}></div>
                                        ) : field.type === 'checkbox-group' || field.type === 'radio-group' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {field.options?.map(opt => (
                                                    <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '12px', height: '12px', border: '1px solid #000', borderRadius: field.type === 'radio-group' ? '50%' : '0' }}></div>
                                                        <span>{opt.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <input type="text" className="form-input" disabled />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            {template.approvalSteps && template.approvalSteps.length > 0 && (
                <>
                    <div className="section-title">OFFICIAL USE ONLY - APPROVALS</div>
                    <table className="generic-table">
                        <thead>
                            <tr>
                                <th>Step</th>
                                <th>Role</th>
                                <th>Signature</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {template.approvalSteps.map(step => (
                                <tr key={step.id}>
                                    <td>{step.title}</td>
                                    <td>{step.approverRole.replace('_', ' ').toUpperCase()}</td>
                                    <td style={{ height: '40px' }}></td>
                                    <td></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                System-generated form template v{template.version} | scpng.gov.pg
            </div>
        </div>
    );
};
