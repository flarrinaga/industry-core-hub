/********************************************************************************
 * Eclipse Tractus-X - Industry Core Hub Frontend
 *
 * Copyright (c) 2025 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Apache License, Version 2.0 which is available at
 * https://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied. See the
 * License for the specific language govern in permissions and limitations
 * under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ********************************************************************************/

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ProductCard } from "../features/catalog-management/components/product-list/ProductCard";
import { PartInstance, ApiPartData } from "../types/product";
import TablePagination from "@mui/material/TablePagination";
import { Typography, Grid2, Box } from "@mui/material"; // Removed Paper
import { Button } from "@catena-x/portal-shared-components";
import AddIcon from "@mui/icons-material/Add";
import ShareDialog from "../components/general/ShareDialog";
import CreateProductListDialog from "../features/partner-management/components/general/CreateProductListDialog";
import { fetchCatalogParts } from "../features/catalog-management/api";
import { mapApiPartDataToPartInstance } from "../features/catalog-management/utils";

const ProductsList = () => {
  const [carParts, setCarParts] = useState<PartInstance[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartInstance | null>(null);
  const [initialCarParts, setInitialCarParts] = useState<PartInstance[]>([]);
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const fetchData = async () => {
    try {
      const apiData: ApiPartData[] = await fetchCatalogParts();

      // Map API data to PartInstance[]
      const mappedCarParts: PartInstance[] = apiData.map((part) =>
        mapApiPartDataToPartInstance(part)
      );

      setCarParts(mappedCarParts);
      setInitialCarParts(mappedCarParts);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchData(); // Call the async function
  }, []);

  const handleButtonClick = (partId: string) => {
    navigate(`/product/${partId}`); // Navigate to the details page
  };

  const handleShareDialog = (
    manufacturerId: string,
    manufacturerPartId: string
  ) => {
    const part = visibleRows.find(
      (p) =>
        p.manufacturerId === manufacturerId &&
        p.manufacturerPartId === manufacturerPartId
    ); // Use carParts directly as visibleRows is a slice
    if (part) {
      console.log("Share dialog for part:", part);
      setSelectedPart(part);
      setShareDialogOpen(true);
    } else {
      console.warn(
        "Part not found for manufacturerId:",
        manufacturerId,
        ", manufacturerPartId:",
        manufacturerPartId
      );
    }
  };

  const handleMore = (manufacturerId: string, manufacturerPartId: string) => {
    console.log(
      "More options for item with manufacturerId:",
      manufacturerId,
      "manufacturerPartId:",
      manufacturerPartId
    );
    // More options logic
  };

  const visibleRows = useMemo(() => {
    return [...carParts].slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [page, rowsPerPage, carParts]);

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  const handleSaveCatalogPart = () => {
    handleCloseCreateDialog();
    fetchData(); // Refresh the list after saving
    console.log("Catalog part saved, refreshing list...");
  };

  return (
    <Box sx={{ p: 3, width: "100%" }}>
      <Grid2 container direction="column" alignItems="center" sx={{ mb: 3 }}>
        <Grid2 className="product-catalog title flex flex-content-center">
          <Typography className="text">Catalog Parts</Typography>
        </Grid2>
        <Grid2
          container
          width={"100%"}
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          sx={{ mt: 1 }}
        >
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
            size="small"
          >
            Create New Catalog Part
          </Button>
        </Grid2>
      </Grid2>

      <Grid2 className="product-catalog" container spacing={1} direction="row">
        <Grid2 className="flex flex-content-center" size={12}>
          <ProductCard
            onClick={handleButtonClick}
            onShare={handleShareDialog}
            onMore={handleMore}
            items={visibleRows.map((part) => ({
              manufacturerId: part.manufacturerId,
              manufacturerPartId: part.manufacturerPartId,
              name: part.name,
              category: part.category,
              status: part.status,
            }))}
          />
        </Grid2>

        <Grid2 size={12} className="flex flex-content-center">
          <TablePagination
            rowsPerPageOptions={[rowsPerPage]}
            component="div"
            count={initialCarParts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            className="product-list-pagination"
          />
        </Grid2>
        {selectedPart && (
          <ShareDialog
            open={shareDialogOpen}
            onClose={() => setShareDialogOpen(false)}
            partData={selectedPart}
          />
        )}
      </Grid2>

      <CreateProductListDialog
        open={isCreateDialogOpen}
        onClose={handleCloseCreateDialog}
        onSave={handleSaveCatalogPart}
      />
    </Box>
  );
};

export default ProductsList;
