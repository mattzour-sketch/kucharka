import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import TabLayout from './components/TabLayout';
import RecipeListScreen from './features/recipes/RecipeListScreen';
import RecipeEditScreen from './features/recipes/RecipeEditScreen';
import RecipeDetailScreen from './features/recipes/RecipeDetailScreen';
import SettingsScreen from './features/settings/SettingsScreen';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Obrazovky se spodní lištou (Fáze 1: Recepty + Víc). */}
        <Route element={<TabLayout />}>
          <Route path="/" element={<RecipeListScreen />} />
          <Route path="/vic" element={<SettingsScreen />} />
        </Route>
        {/* Vysunuté obrazovky bez lišty, s vlastní horní lištou. */}
        <Route path="/novy" element={<RecipeEditScreen />} />
        <Route path="/recept/:id" element={<RecipeDetailScreen />} />
        <Route path="/recept/:id/upravit" element={<RecipeEditScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
