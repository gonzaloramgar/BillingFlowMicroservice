<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:fo="http://www.w3.org/1999/XSL/Format">
    <xsl:template match="/factura">
        <fo:root>
            <fo:layout-master-set>
                <fo:simple-page-master master-name="A4" page-height="29.7cm" page-width="21cm" margin="2cm">
                    <fo:region-body/>
                </fo:simple-page-master>
            </fo:layout-master-set>

            <fo:page-sequence master-reference="A4">
                <fo:flow flow-name="xsl-region-body">
                    
                    <!-- ENCABEZADO -->
                    <fo:block background-color="#2c3e50" color="white" padding="10pt" font-size="20pt" font-weight="bold" text-align="center" margin-bottom="20pt">
                        FACTURA OFICIAL
                    </fo:block>

                    <!-- DATOS CLIENTE/EMISOR -->
                    <fo:table table-layout="fixed" width="100%" margin-bottom="30pt">
                        <fo:table-column column-width="50%"/>
                        <fo:table-column column-width="50%"/>
                        <fo:table-body>
                            <fo:table-row>
                                <fo:table-cell>
                                    <fo:block font-weight="bold">EMISOR:</fo:block>
                                    <fo:block>Invoice Service App S.A.</fo:block>
                                    <fo:block>CIF: B-12345678</fo:block>
                                </fo:table-cell>
                                <fo:table-cell text-align="right">
                                    <fo:block font-weight="bold">CLIENTE:</fo:block>
                                    <fo:block color="#2980b9" font-size="12pt"><xsl:value-of select="cliente"/></fo:block>
                                    <fo:block>Fecha: <xsl:value-of select="fecha"/></fo:block>
                                </fo:table-cell>
                            </fo:table-row>
                        </fo:table-body>
                    </fo:table>

                    <!-- TABLA DE CONCEPTOS -->
                    <fo:table table-layout="fixed" width="100%" border-collapse="separate">
                        <fo:table-column column-width="15%"/>
                        <fo:table-column column-width="55%"/>
                        <fo:table-column column-width="30%"/>
                        
                        <fo:table-header>
                            <fo:table-row background-color="#ecf0f1" font-weight="bold">
                                <fo:table-cell border="1pt solid #bdc3c7" padding="5pt"><fo:block>ID</fo:block></fo:table-cell>
                                <fo:table-cell border="1pt solid #bdc3c7" padding="5pt"><fo:block>Descripción</fo:block></fo:table-cell>
                                <fo:table-cell border="1pt solid #bdc3c7" padding="5pt" text-align="right"><fo:block>Monto</fo:block></fo:table-cell>
                            </fo:table-row>
                        </fo:table-header>

                        <fo:table-body>
                            <fo:table-row>
                                <fo:table-cell border="1pt solid #eee" padding="8pt"><fo:block><xsl:value-of select="id"/></fo:block></fo:table-cell>
                                <fo:table-cell border="1pt solid #eee" padding="8pt"><fo:block>Servicios de consultoría informática</fo:block></fo:table-cell>
                                <fo:table-cell border="1pt solid #eee" padding="8pt" text-align="right"><fo:block><xsl:value-of select="montoBase"/> €</fo:block></fo:table-cell>
                            </fo:table-row>

                            <!-- DESGLOSE -->
                            <fo:table-row>
                                <fo:table-cell number-columns-spanned="2" padding="5pt" text-align="right" font-size="10pt"><fo:block>Base Imponible:</fo:block></fo:table-cell>
                                <fo:table-cell padding="5pt" text-align="right" font-size="10pt"><fo:block><xsl:value-of select="montoBase"/> €</fo:block></fo:table-cell>
                            </fo:table-row>
                            <fo:table-row>
                                <fo:table-cell number-columns-spanned="2" padding="5pt" text-align="right" font-size="10pt"><fo:block>IVA (21%):</fo:block></fo:table-cell>
                                <fo:table-cell padding="5pt" text-align="right" font-size="10pt"><fo:block><xsl:value-of select="iva"/> €</fo:block></fo:table-cell>
                            </fo:table-row>
                        </fo:table-body>
                    </fo:table>

                    <!-- TOTAL FINAL -->
                    <fo:block text-align="right" margin-top="15pt" font-size="16pt" font-weight="bold">
                        TOTAL A PAGAR: <fo:inline color="#e74c3c"><xsl:value-of select="total"/> €</fo:inline>
                    </fo:block>

                </fo:flow>
            </fo:page-sequence>
        </fo:root>
    </xsl:template>
</xsl:stylesheet>